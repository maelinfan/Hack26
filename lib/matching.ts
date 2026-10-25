import { after } from "next/server";
import { db } from "@/lib/db";
import { rerankCandidates, type RerankCandidate } from "@/lib/ai";
import { COOLDOWN_SECONDS, PROPOSAL_TTL_SECONDS, SCORE_THRESHOLD, TOP_N } from "@/lib/config";
import type { Distance, Filters, Follow, Presence, Relationship, User } from "@/lib/types";

// The matching pipeline (SPEC §4): hard filters -> soft score -> AI rerank -> one proposal for both.

// ---- small pure helpers (exported: the proposal view reuses them) ---------------------

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8; // earth radius in miles
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Clients only ever see a bucket, never coordinates (SPEC §2).
export function distanceBucket(miles: number): Distance {
  return miles < 0.25 ? "very_close" : "nearby";
}

// How `viewer` relates to `other`, strongest first (SPEC §3).
export function relationshipOf(viewerId: string, otherId: string, follows: Follow[]): Relationship {
  const out = follows.find((f) => f.follower_id === viewerId && f.followee_id === otherId);
  const back = follows.some((f) => f.follower_id === otherId && f.followee_id === viewerId);
  if (out?.close_friend) return "close_friends";
  if (out && back) return "mutual";
  if (out) return "following";
  if (back) return "follows_you";
  return "none";
}

// Does `other` pass the viewer's filters (age, gender, follow status)?
export function passesFilters(f: Filters, other: User, relationship: Relationship) {
  return (
    other.age >= f.age_min &&
    other.age <= f.age_max &&
    f.genders.includes(other.gender) &&
    (f.follow_statuses.includes("anyone") || f.follow_statuses.includes(relationship as never))
  );
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// Soft score 0-1: weighted tag overlap, exact match = full weight, adjacent = half.
// Normalized by the smaller profile so a short list of interests isn't punished.
export function matchScore(me: User, other: User, relationship: Relationship, myFilters: Filters) {
  const mine = new Map(me.tags.map((t) => [t.tag, t.weight]));
  const theirs = new Map(other.tags.map((t) => [t.tag, t.weight]));
  const myAdj = new Set(me.adjacent_tags);
  const theirAdj = new Set(other.adjacent_tags);

  let raw = 0;
  for (const [tag, w] of mine) {
    if (theirs.has(tag)) raw += (w + theirs.get(tag)!) / 2; // exact
    else if (theirAdj.has(tag)) raw += w * 0.5; // my tag is in their adjacent list
  }
  for (const [tag, w] of theirs) {
    if (!mine.has(tag) && myAdj.has(tag)) raw += w * 0.5; // their tag is in my adjacent list
  }

  const denom = Math.min(sum([...mine.values()]), sum([...theirs.values()]));
  if (denom === 0) return 0;

  // Small bonus for closeness, only if the user's own filters ask for that kind of person.
  const bonus =
    (relationship === "mutual" || relationship === "close_friends") &&
    myFilters.follow_statuses.includes(relationship)
      ? 0.1
      : 0;
  return Math.min(1, raw / denom + bonus);
}

// Interests the two have in common (exact matches first, then adjacent ones). Shown in the UI
// and handed to the AI so it only talks about real overlaps.
export function sharedTags(me: User, other: User): string[] {
  const theirs = new Map(other.tags.map((t) => [t.tag, t.weight]));
  const exact = me.tags
    .filter((t) => theirs.has(t.tag))
    .sort((a, b) => b.weight + theirs.get(b.tag)! - (a.weight + theirs.get(a.tag)!))
    .map((t) => t.tag);
  const adjacent = [
    ...me.tags.filter((t) => !theirs.has(t.tag) && other.adjacent_tags.includes(t.tag)).map((t) => t.tag),
    ...other.tags
      .filter((t) => !me.tags.some((m) => m.tag === t.tag) && me.adjacent_tags.includes(t.tag))
      .map((t) => t.tag),
  ];
  return [...new Set([...exact, ...adjacent])];
}

// What the AI is shown about one candidate. Shared with the cache warm-up so both build
// identical inputs (and therefore identical cache keys).
export function toRerankCandidate(me: User, other: User, score: number): RerankCandidate {
  return { id: other.id, name: other.name, tags: other.tags, shared_tags: sharedTags(me, other), score };
}

// ---- one match at a time ---------------------------------------------------------------

// Two users' searches must not run at the same moment, or both could grab the same person.
// This queue makes them run one after another (fine for a single dev/demo server).
const g = globalThis as { __matchQueue?: Promise<unknown> };
function inQueue<T>(task: () => Promise<T>): Promise<T> {
  const result = (g.__matchQueue ?? Promise.resolve()).catch(() => {}).then(task);
  g.__matchQueue = result.catch(() => {});
  return result;
}

const DEFAULT_FILTERS = (user_id: string): Filters => ({
  user_id,
  age_min: 18,
  age_max: 65,
  genders: ["woman", "man", "nonbinary"],
  follow_statuses: ["anyone"],
  radius_mi: 1,
});

// Finds a match for `userId` and creates a proposal for BOTH people.
// Returns the new proposal id, or null (not available, already in one, or nobody suitable).
export function runMatchForUser(userId: string): Promise<string | null> {
  return inQueue(() => match(userId));
}

// Same search, but after the HTTP response has gone out, so the poll/toggle that triggered it
// doesn't wait for the AI call. The UI's next poll picks up the new proposal.
export function matchInBackground(userId: string) {
  after(async () => {
    try {
      await runMatchForUser(userId);
    } catch (err) {
      console.error(`[match] ${userId}:`, err instanceof Error ? err.message : err);
    }
  });
}

// Two people were just freed (proposal expired or was declined). Each looks for someone new,
// but the one with the better next option goes first, so one can't snatch the other's best match.
// `first` forces one person to go first (the one who just declined).
export function rematchPair(a: string, b: string, first?: string) {
  after(async () => {
    const ranked = await Promise.all(
      [a, b].map(async (id) => ({
        id,
        top: (await shortlistFor(id).catch(() => null))?.shortlist[0]?.score ?? 0,
      })),
    );
    ranked.sort(
      (x, y) =>
        Number(y.id === first) - Number(x.id === first) || y.top - x.top || x.id.localeCompare(y.id),
    );
    for (const { id } of ranked) {
      await runMatchForUser(id).catch((err) =>
        console.error(`[match] ${id}:`, err instanceof Error ? err.message : err),
      );
    }
  });
}

type Scored = { user: User; score: number };

// Steps 1-3 (no AI): who is online, hard filters, soft score. Returns null if this user can't
// be matched right now (offline or already in a proposal), else the scored shortlist (maybe empty).
async function shortlistFor(userId: string): Promise<{ me: User; shortlist: Scored[] } | null> {
  const nowIso = new Date().toISOString();

  // 1. Who is online right now? (active, and the window hasn't run out)
  const { data: online, error } = await db
    .from("presence")
    .select("*")
    .eq("active", true)
    .gt("available_until", nowIso);
  if (error) throw new Error(error.message);
  const presences = (online ?? []) as Presence[];
  const myPresence = presences.find((p) => p.user_id === userId);
  if (!myPresence) return null; // I'm not online

  // 2. Everything else we need, in parallel.
  const ids = presences.map((p) => p.user_id);
  const [usersRes, filtersRes, followsRes, busyRes, historyRes] = await Promise.all([
    db.from("users").select("*").in("id", ids),
    db.from("filters").select("*").in("user_id", ids),
    db.from("follows").select("*").or(`follower_id.eq.${userId},followee_id.eq.${userId}`),
    // "In a proposal" = pending, both_accepted, or confirmed (they're about to meet someone).
    db.from("proposals").select("user_a,user_b").in("state", ["pending", "both_accepted", "confirmed"]),
    db
      .from("proposals")
      .select("user_a,user_b,state,decline_reason,created_at")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`),
  ]);
  for (const r of [usersRes, filtersRes, followsRes, busyRes, historyRes]) {
    if (r.error) throw new Error(r.error.message);
  }
  const users = new Map((usersRes.data as User[]).map((u) => [u.id, u]));
  const filters = new Map((filtersRes.data as Filters[]).map((f) => [f.user_id, f]));
  const follows = followsRes.data as Follow[];

  const busy = new Set<string>();
  for (const p of busyRes.data ?? []) {
    busy.add(p.user_a);
    busy.add(p.user_b);
  }
  if (busy.has(userId)) return null; // I already have a proposal

  // People I must not be matched with: recently seen (cooldown) or "not interested" ever.
  const cooldownStart = Date.now() - COOLDOWN_SECONDS * 1000;
  const excluded = new Set<string>();
  for (const h of historyRes.data ?? []) {
    const other = h.user_a === userId ? h.user_b : h.user_a;
    if (h.decline_reason === "not_interested") excluded.add(other);
    else if (h.state !== "confirmed" && new Date(h.created_at).getTime() > cooldownStart) excluded.add(other);
  }

  const me = users.get(userId);
  if (!me) return null;
  const myFilters = filters.get(userId) ?? DEFAULT_FILTERS(userId);

  // 3. Hard filters, then soft score.
  const scored: Scored[] = [];
  for (const p of presences) {
    const other = users.get(p.user_id);
    if (!other || p.user_id === userId) continue;
    if (busy.has(p.user_id) || excluded.has(p.user_id)) continue;

    const theirFilters = filters.get(p.user_id) ?? DEFAULT_FILTERS(p.user_id);
    const miles = haversineMiles(myPresence, p);
    if (miles > myFilters.radius_mi || miles > theirFilters.radius_mi) continue; // BOTH radii

    const myView = relationshipOf(userId, p.user_id, follows);
    const theirView = relationshipOf(p.user_id, userId, follows);
    if (!passesFilters(myFilters, other, myView)) continue;
    if (!passesFilters(theirFilters, me, theirView)) continue;
    // (No block list yet: /api/block is a UI-only stub.)

    const score = matchScore(me, other, myView, myFilters);
    if (score >= SCORE_THRESHOLD) scored.push({ user: other, score });
  }
  scored.sort((a, b) => b.score - a.score || a.user.id.localeCompare(b.user.id));
  return { me, shortlist: scored.slice(0, TOP_N) };
}

async function match(userId: string): Promise<string | null> {
  const found = await shortlistFor(userId);
  if (!found || found.shortlist.length === 0) return null;
  const { me, shortlist } = found;

  // 4. AI picks one of the shortlist and writes the explanations + icebreakers.
  const result = await rerankCandidates(
    { id: me.id, name: me.name, tags: me.tags },
    shortlist.map((c) => toRerankCandidate(me, c.user, c.score)),
  );
  const chosen = shortlist.find((c) => c.user.id === result.chosen_id) ?? shortlist[0];

  // 5. The AI call took a while. Make sure neither person got taken in the meantime.
  const { data: nowBusy } = await db
    .from("proposals")
    .select("id")
    .in("state", ["pending", "both_accepted", "confirmed"])
    .or(`user_a.in.(${userId},${chosen.user.id}),user_b.in.(${userId},${chosen.user.id})`);
  if (nowBusy && nowBusy.length > 0) return null;

  // 6. One row = one proposal shown to both people.
  const { data: created, error: insertError } = await db
    .from("proposals")
    .insert({
      user_a: userId,
      user_b: chosen.user.id,
      state: "pending",
      why_a: result.why_for_me,
      why_b: result.why_for_them,
      icebreakers: result.icebreakers,
      score: chosen.score,
      expires_at: new Date(Date.now() + PROPOSAL_TTL_SECONDS * 1000).toISOString(),
    })
    .select("id")
    .single();
  // 23505 = the "one active proposal per user" safety-net index fired: someone beat us to it.
  if (insertError) {
    if (insertError.code === "23505") return null;
    throw new Error(insertError.message);
  }
  return created.id as string;
}
