import { db } from "@/lib/db";
import { MATCH_RATE_LIMIT_MS, OUTCOME_WINDOW_MS } from "@/lib/config";
import { clearReplanning, planInBackground, type VenueMeta } from "@/lib/planner";
import {
  distanceBucket,
  haversineMiles,
  matchInBackground,
  mutualConnections,
  relationshipOf,
  rematchPair,
  sharedTags,
} from "@/lib/matching";
import type { Follow, Presence, ProposalRow, User } from "@/lib/types";

// What GET /api/proposal returns (SPEC §6). Built per viewer, so each person sees
// the text written for them and never the other person's actual answer.

// Small in-memory state, kept on globalThis so dev-server reloads don't wipe it.
// Fine for one demo server; a real deployment would keep this in the database.
const mem = globalThis as { __lastSearch?: Map<string, number>; __seenOutcomes?: Set<string> };
const lastSearch = (mem.__lastSearch ??= new Map<string, number>());
const seenOutcomes = (mem.__seenOutcomes ??= new Set<string>());

// Expiry is lazy (SPEC §5): runs at the start of every poll instead of on a timer.
// Expired pairs are freed and both people immediately look for someone new
// (the pair itself is on cooldown, so they won't be matched again right away).
// The searches run in the background so this poll answers immediately.
export async function expireStale() {
  const { data, error } = await db
    .from("proposals")
    .update({ state: "expired" })
    .eq("state", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("user_a,user_b");
  if (error) throw new Error(error.message);
  for (const p of data ?? []) {
    rematchPair(p.user_a, p.user_b);
  }
}

async function buildView(userId: string, row: ProposalRow) {
  const iAmA = row.user_a === userId;
  const otherId = iAmA ? row.user_b : row.user_a;

  const [usersRes, presenceRes, followsRes, namesRes] = await Promise.all([
    db.from("users").select("*").in("id", [userId, otherId]),
    db.from("presence").select("*").in("user_id", [userId, otherId]),
    db.from("follows").select("*"), // whole (small) graph: mutual connections need both people's edges
    db.from("users").select("id,name"),
  ]);
  const me = (usersRes.data as User[] | null)?.find((u) => u.id === userId);
  const other = (usersRes.data as User[] | null)?.find((u) => u.id === otherId);
  const presences = (presenceRes.data ?? []) as Presence[];
  const myPos = presences.find((p) => p.user_id === userId);
  const theirPos = presences.find((p) => p.user_id === otherId);
  if (!me || !other) throw new Error("proposal references a missing user");

  const names = new Map((namesRes.data ?? []).map((u) => [u.id as string, u.name as string]));

  // The venue carries private bookkeeping (_meta). Split it off: clients get the plain venue plus
  // derived fields (walking times, a notice after a re-plan, whether a re-plan is running).
  const { _meta, ...venue } = (row.venue ?? {}) as Record<string, unknown> & { _meta?: VenueMeta };
  const hasVenue = row.venue != null;

  const myResponse = iAmA ? row.a_response : row.b_response;
  const theirResponse = iAmA ? row.b_response : row.a_response;

  return {
    id: row.id,
    state: row.state,
    other: {
      name: other.name,
      handle: other.handle,
      age: other.age,
      avatar_url: other.avatar_url,
      verified: other.verified,
      relationship: relationshipOf(userId, otherId, (followsRes.data ?? []) as Follow[]),
      distance: myPos && theirPos ? distanceBucket(haversineMiles(myPos, theirPos)) : "nearby",
    },
    why: (iAmA ? row.why_a : row.why_b) ?? "",
    shared_tags: sharedTags(me, other),
    mutual_connections: mutualConnections(userId, otherId, (followsRes.data ?? []) as Follow[], names),
    icebreakers: row.icebreakers ?? [],
    my_response: myResponse,
    other_responded: theirResponse !== null, // only THAT they answered, never what
    expires_at: new Date(row.expires_at).toISOString(),
    server_now: new Date().toISOString(),
    venue: hasVenue ? venue : null,
    walking:
      hasVenue && _meta?.walk_minutes
        ? { you_minutes: _meta.walk_minutes[userId] ?? null, other_minutes: _meta.walk_minutes[otherId] ?? null }
        : null,
    notice: _meta?.late
      ? `${_meta.late.by} is running about ${_meta.late.minutes} min late. ` +
        (_meta.late.same
          ? `Plan checked: ${venue.name} still works.`
          : `Plan updated: moved from ${_meta.late.previous} to ${venue.name}.`)
      : null,
    replanning: !!_meta?.replanning,
    plan_reason: row.plan_reason ?? null,
    tool_calls: row.tool_calls ?? null,
  };
}

// The whole GET /api/proposal logic. Returns null if the user doesn't exist.
export async function getProposalFor(userId: string) {
  const { data: user } = await db.from("users").select("id").eq("id", userId).maybeSingle();
  if (!user) return null;

  // 1. Retire stale proposals first.
  await expireStale();

  // 2. Report a declined/expired outcome ONCE, before anything newer (SPEC §6).
  const since = new Date(Date.now() - OUTCOME_WINDOW_MS).toISOString();
  const { data: ended } = await db
    .from("proposals")
    .select("id,state")
    .in("state", ["declined", "expired"])
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  const unseen = (ended ?? []).find((p) => !seenOutcomes.has(`${p.id}:${userId}`));
  if (unseen) {
    seenOutcomes.add(`${unseen.id}:${userId}`);
    return { proposal: null, last_outcome: unseen.state as "declined" | "expired" };
  }

  // 3. Current proposal (a confirmed one stays visible while the user is still "on").
  const { data: presence } = await db.from("presence").select("*").eq("user_id", userId).maybeSingle();
  const isOn =
    !!presence?.active && !!presence.available_until && new Date(presence.available_until) > new Date();

  const findCurrent = async () => {
    const { data } = await db
      .from("proposals")
      .select("*")
      .in("state", ["pending", "both_accepted", "confirmed"])
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data?.[0] ?? null) as ProposalRow | null;
    return row && (row.state !== "confirmed" || isOn) ? row : null;
  };

  const current = await findCurrent();
  if (current) {
    // A both_accepted proposal with no plan yet (e.g. the server restarted mid-plan): try again.
    if (current.state === "both_accepted") planInBackground(current.id);
    return { proposal: await buildView(userId, current) };
  }

  // 4. Nothing yet. If the user is on, look for someone (at most once per 3s per user).
  if (!isOn) return { proposal: null, searching: false };
  const last = lastSearch.get(userId) ?? 0;
  if (Date.now() - last >= MATCH_RATE_LIMIT_MS) {
    lastSearch.set(userId, Date.now());
    matchInBackground(userId); // runs after this response; the next poll will see the result
  }
  return { proposal: null, searching: true };
}

// ---- responding (SPEC §5) -----------------------------------------------------------------

export type RespondResult =
  | { status: 200; body: { ok: true; state: "pending" | "both_accepted" | "declined" } }
  | { status: 403 | 404 | 409; body: { ok: false; error: string; state?: string } };

// Accept or decline. Only the first answer from each side counts, and answering a proposal that
// is no longer pending is a 409. Each step is a conditional update ("only if still pending"),
// so two people answering at the same instant can't corrupt the state.
export async function respondToProposal(
  id: string,
  userId: string,
  response: "accept" | "decline",
  reason: "not_now" | "not_interested",
): Promise<RespondResult> {
  await expireStale(); // lazy expiry first

  const read = async () => {
    const { data } = await db.from("proposals").select("*").eq("id", id).maybeSingle();
    return data as ProposalRow | null;
  };
  let row = await read();
  if (!row) return { status: 404, body: { ok: false, error: "proposal not found" } };
  if (row.user_a !== userId && row.user_b !== userId) {
    return { status: 403, body: { ok: false, error: "not part of this proposal" } };
  }
  if (row.state !== "pending") {
    return { status: 409, body: { ok: false, error: `proposal is already ${row.state}`, state: row.state } };
  }

  const side = row.user_a === userId ? "a_response" : "b_response";
  const otherId = row.user_a === userId ? row.user_b : row.user_a;
  if (row[side] !== null) return { status: 200, body: { ok: true, state: "pending" } }; // first answer counts

  if (response === "decline") {
    // Declined: both are freed. The pair goes on cooldown (the row itself is the cooldown record);
    // "not_interested" also excludes them from each other permanently. The decliner searches first.
    const { data } = await db
      .from("proposals")
      .update({ [side]: "decline", state: "declined", decline_reason: reason })
      .eq("id", id)
      .eq("state", "pending")
      .select("id");
    if (!data || data.length === 0) {
      const now = await read();
      return { status: 409, body: { ok: false, error: `proposal is already ${now?.state}`, state: now?.state } };
    }
    rematchPair(userId, otherId, userId);
    return { status: 200, body: { ok: true, state: "declined" } };
  }

  // Accept: record it, but only if still pending and this side hasn't answered.
  const { data: saved } = await db
    .from("proposals")
    .update({ [side]: "accept" })
    .eq("id", id)
    .eq("state", "pending")
    .is(side, null)
    .select("id");
  if (!saved || saved.length === 0) {
    const now = await read();
    if (now && now.state !== "pending") {
      return { status: 409, body: { ok: false, error: `proposal is already ${now.state}`, state: now.state } };
    }
    return { status: 200, body: { ok: true, state: "pending" } };
  }

  // Both said yes? Move to both_accepted. (Re-read, then flip only if still pending, so if both
  // people accept at once, exactly one of the two requests performs the flip.)
  row = await read();
  if (row && row.a_response === "accept" && row.b_response === "accept") {
    const { data: flipped } = await db
      .from("proposals")
      .update({ state: "both_accepted" })
      .eq("id", id)
      .eq("state", "pending")
      .select("id");
    if (flipped && flipped.length > 0) planInBackground(id); // the venue agent picks a place
    return { status: 200, body: { ok: true, state: "both_accepted" } };
  }
  return { status: 200, body: { ok: true, state: "pending" } };
}

// ---- other ways a proposal ends -------------------------------------------------------------

// A person turned "Meet nearby" off: any proposal they were still in ends, and the other
// person is freed and starts searching again. (A confirmed plan is left alone.)
export async function endProposalsFor(userId: string) {
  const { data } = await db
    .from("proposals")
    .update({ state: "declined", decline_reason: "not_now" })
    .in("state", ["pending", "both_accepted"])
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .select("user_a,user_b");
  for (const p of data ?? []) matchInBackground(p.user_a === userId ? p.user_b : p.user_a);
}

// A person moved (pin drag): if a still-pending proposal is no longer within both radii, cancel
// it. Treated like an expiry (cooldown only), and both look for someone new.
export async function cancelIfOutOfRange(userId: string) {
  const { data } = await db
    .from("proposals")
    .select("id,user_a,user_b")
    .eq("state", "pending")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .limit(1);
  const p = data?.[0];
  if (!p) return;

  const ids = [p.user_a, p.user_b];
  const [pos, fil] = await Promise.all([
    db.from("presence").select("*").in("user_id", ids),
    db.from("filters").select("user_id,radius_mi").in("user_id", ids),
  ]);
  const [a, b] = ids.map((id) => (pos.data ?? []).find((x) => x.user_id === id));
  if (!a || !b) return;
  const radius = Math.min(...ids.map((id) => (fil.data ?? []).find((f) => f.user_id === id)?.radius_mi ?? 1));
  if (haversineMiles(a, b) <= radius) return;

  const { data: ended } = await db
    .from("proposals")
    .update({ state: "expired" })
    .eq("id", p.id)
    .eq("state", "pending")
    .select("id");
  if (ended && ended.length > 0) rematchPair(p.user_a, p.user_b);
}

// ---- running late ------------------------------------------------------------------------------

export type LateResult =
  | { status: 200; body: { ok: true; replanning: true } }
  | { status: 403 | 404 | 409; body: { ok: false; error: string } };

const MAX_REPLANS = 2;

// "I'm running late": flag the proposal as re-planning and let the venue agent pick again, around
// the later meeting time and closer to the person running late. Answers at once; the UI polls.
export async function requestLate(id: string, userId: string, minutes: number): Promise<LateResult> {
  const { data } = await db.from("proposals").select("*").eq("id", id).maybeSingle();
  const row = data as ProposalRow | null;
  if (!row) return { status: 404, body: { ok: false, error: "proposal not found" } };
  if (row.user_a !== userId && row.user_b !== userId) {
    return { status: 403, body: { ok: false, error: "not part of this proposal" } };
  }
  const venue = row.venue as (Record<string, unknown> & { _meta?: VenueMeta }) | null;
  if (row.state !== "confirmed" || !venue) {
    return { status: 409, body: { ok: false, error: `proposal is ${row.state}; it must be confirmed` } };
  }
  const meta: VenueMeta = venue._meta ?? { walk_minutes: {} };
  if (meta.replanning) return { status: 409, body: { ok: false, error: "already re-planning" } };
  if ((meta.replans ?? 0) >= MAX_REPLANS) {
    return { status: 409, body: { ok: false, error: `plan already changed ${MAX_REPLANS} times` } };
  }

  const { data: marked } = await db
    .from("proposals")
    .update({ venue: { ...venue, _meta: { ...meta, replanning: true } } })
    .eq("id", id)
    .eq("state", "confirmed")
    .select("id");
  if (!marked || marked.length === 0) {
    return { status: 409, body: { ok: false, error: "proposal is no longer confirmed" } };
  }
  if (!planInBackground(id, { userId, minutes })) {
    await clearReplanning(id); // the planner declined to start: undo the flag so nothing hangs
    return { status: 409, body: { ok: false, error: "re-plan could not start; try again in a few seconds" } };
  }
  return { status: 200, body: { ok: true, replanning: true } };
}
