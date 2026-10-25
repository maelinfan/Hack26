import { after } from "next/server";
import { rerankCandidates } from "@/lib/ai";
import { SCORE_THRESHOLD } from "@/lib/config";
import { db } from "@/lib/db";
import {
  haversineMiles,
  matchScore,
  mutualConnections,
  passesFilters,
  relationshipOf,
  toRerankCandidate,
} from "@/lib/matching";
import type { Filters, Follow, Presence, User } from "@/lib/types";

// POST /api/sim/warm -> pre-fill the AI cache for the demo cast, so the first take isn't a
// 5-10 second wait. It asks the AI to explain every match the demo could plausibly produce
// (each cast member as the searcher, against every combination of the others being online).
// Answers are saved in ai_cache, which survives /api/sim/reset. Run it once after reseeding
// (and again if the AI prompt or the personas change). Costs one paid call per uncached case,
// counted against the call budget. Add ?dry=1 to only count the cases.

const CAST = ["maya", "jordan", "priya", "sam"];

export async function POST(req: Request) {
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const [users, filters, follows, presence, allNames] = await Promise.all([
    db.from("users").select("*").in("id", CAST),
    db.from("filters").select("*").in("user_id", CAST),
    db.from("follows").select("*"),
    db.from("presence").select("*").in("user_id", CAST),
    db.from("users").select("id,name"),
  ]);
  const err = users.error ?? filters.error ?? follows.error ?? presence.error ?? allNames.error;
  if (err) return Response.json({ ok: false, error: err.message }, { status: 500 });

  const U = new Map((users.data as User[]).map((u) => [u.id, u]));
  const F = new Map((filters.data as Filters[]).map((f) => [f.user_id, f]));
  const P = new Map((presence.data as Presence[]).map((p) => [p.user_id, p]));
  const edges = follows.data as Follow[];
  const names = new Map((allNames.data ?? []).map((u) => [u.id as string, u.name as string]));
  if (CAST.some((id) => !U.has(id) || !F.has(id) || !P.has(id))) {
    return Response.json({ ok: false, error: "demo cast missing: run POST /api/sim/reset first" }, { status: 409 });
  }

  // For each possible searcher: who could they be matched with, and every non-empty
  // combination of those people being online at once.
  const jobs: { me: User; candidates: ReturnType<typeof toRerankCandidate>[] }[] = [];
  for (const meId of CAST) {
    const me = U.get(meId)!;
    const eligible = CAST.filter((id) => id !== meId)
      .map((id) => U.get(id)!)
      .filter((other) => {
        const miles = haversineMiles(P.get(meId)!, P.get(other.id)!);
        if (miles > F.get(meId)!.radius_mi || miles > F.get(other.id)!.radius_mi) return false;
        return (
          passesFilters(F.get(meId)!, other, relationshipOf(meId, other.id, edges)) &&
          passesFilters(F.get(other.id)!, me, relationshipOf(other.id, meId, edges))
        );
      })
      .map((other) => ({
        other,
        score: matchScore(me, other, relationshipOf(meId, other.id, edges), F.get(meId)!),
      }))
      .filter((c) => c.score >= SCORE_THRESHOLD);

    for (let mask = 1; mask < 1 << eligible.length; mask++) {
      const subset = eligible.filter((_, i) => mask & (1 << i));
      jobs.push({ me, candidates: subset.map((c) => toRerankCandidate(me, c.other, c.score, mutualConnections(meId, c.other.id, edges, names))) });
    }
  }

  if (dry) return Response.json({ ok: true, cases: jobs.length });

  // Takes a minute or two, so answer now and keep going in the background (watch the server log).
  after(async () => {
    const tally = { cache: 0, model: 0, fallback: 0 };
    for (const [i, job] of jobs.entries()) {
      try {
        const r = await rerankCandidates({ id: job.me.id, name: job.me.name, tags: job.me.tags }, job.candidates);
        tally[r.source]++;
      } catch (e) {
        console.error("[warm] case failed:", e instanceof Error ? e.message : e);
      }
      console.log(`[warm] ${i + 1}/${jobs.length} (${job.me.id} vs ${job.candidates.map((c) => c.id).join("+")})`);
    }
    console.log(`[warm] done. already cached: ${tally.cache}, newly asked the model: ${tally.model}, fell back: ${tally.fallback}`);
  });
  return Response.json({ ok: true, scheduled: jobs.length, note: "running in the background; see the server log for '[warm] done'" });
}
