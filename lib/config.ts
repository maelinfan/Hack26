// Tunable constants for matching and proposals (SPEC §4, §5).

export const PROPOSAL_TTL_SECONDS = 45; // production would be 120-180
export const COOLDOWN_SECONDS = 120; // demo value; SPEC says 10 minutes in production
export const SCORE_THRESHOLD = 0.35; // candidates scoring below this are never shown
export const TOP_N = 3; // how many candidates the AI gets to choose between
export const MATCH_RATE_LIMIT_MS = 3000; // GET /api/proposal triggers a search at most this often per user
export const OUTCOME_WINDOW_MS = 180_000; // a declined/expired result is only reported for this long
