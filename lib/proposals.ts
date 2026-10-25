import { db } from "@/lib/db";
import { MATCH_RATE_LIMIT_MS, OUTCOME_WINDOW_MS } from "@/lib/config";
import { distanceBucket, haversineMiles, relationshipOf, matchInBackground, rematchPair, sharedTags } from "@/lib/matching";
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

  const [usersRes, presenceRes, followsRes] = await Promise.all([
    db.from("users").select("*").in("id", [userId, otherId]),
    db.from("presence").select("*").in("user_id", [userId, otherId]),
    db.from("follows").select("*").or(`follower_id.eq.${userId},followee_id.eq.${userId}`),
  ]);
  const me = (usersRes.data as User[] | null)?.find((u) => u.id === userId);
  const other = (usersRes.data as User[] | null)?.find((u) => u.id === otherId);
  const presences = (presenceRes.data ?? []) as Presence[];
  const myPos = presences.find((p) => p.user_id === userId);
  const theirPos = presences.find((p) => p.user_id === otherId);
  if (!me || !other) throw new Error("proposal references a missing user");

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
    icebreakers: row.icebreakers ?? [],
    my_response: myResponse,
    other_responded: theirResponse !== null, // only THAT they answered, never what
    expires_at: new Date(row.expires_at).toISOString(),
    server_now: new Date().toISOString(),
    venue: row.venue ?? null,
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

  let current = await findCurrent();
  if (current) return { proposal: await buildView(userId, current) };

  // 4. Nothing yet. If the user is on, look for someone (at most once per 3s per user).
  if (!isOn) return { proposal: null, searching: false };
  const last = lastSearch.get(userId) ?? 0;
  if (Date.now() - last >= MATCH_RATE_LIMIT_MS) {
    lastSearch.set(userId, Date.now());
    matchInBackground(userId); // runs after this response; the next poll will see the result
  }
  return { proposal: null, searching: true };
}
