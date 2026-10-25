# SPEC.md: "Nearby" (Instagram feature: meet people near you, in person)

Paste this file into every AI coding session. If code and spec disagree, fix the spec first, then both sides.

## 0. Product in one paragraph
Users (18+) turn on "Meet nearby" for a time window. The server finds a high-scoring nearby person who passes both users' filters, creates ONE proposal shown to both at the same time, with a 45s countdown. Both accept -> an AI venue agent picks a public place -> confirmed screen with conversation starters. Decline or expiry -> both released, cooldown on the pair, new match is found.

## 1. Stack and ownership
- Next.js (App Router, TypeScript) + Supabase Postgres. Polling every 1500ms (no websockets).
- AI: Muse Spark via `openai` npm package. Env: `MODEL_API_KEY`, `MODEL_BASE_URL=https://api.meta.ai/v1`, `MODEL_NAME=muse-spark-1.1`.
- Person 1 owns `/lib`, `/app/api`, `/data`, `/supabase`. Person 2 owns `/app/(ui)`, `/components`, `/app/sim`. Do not edit the other person's folders.
- Until the backend works, Person 2 uses `/data/mock/*.json` matching the shapes below.

## 2. Simulated location
No GPS. Each user has `lat, lng` set by dragging a pin on `/sim`. Distance = haversine on those values. Server returns distance only as a bucket: `"very_close"` (<0.25 mi), `"nearby"` (<1 mi). Never send the other user's coordinates to a client. Default radius: 1 mile.

## 3. Database schema (Postgres)
```
users(id text pk, name, handle, age int, gender text, bio text,
      interests_raw text, tags jsonb,          -- [{tag, category, weight 0-1}]
      adjacent_tags text[], verified bool default true, avatar_url text)
follows(follower_id, followee_id, close_friend bool default false)   -- directed edge
filters(user_id pk, age_min int, age_max int, genders text[],
        follow_statuses text[], radius_mi float default 1)
  -- follow_statuses values: close_friends | mutual | following | follows_you | anyone
presence(user_id pk, lat float, lng float, available_until timestamptz, active bool)
proposals(id uuid pk, user_a text, user_b text,
          state text,        -- pending | both_accepted | confirmed | declined | expired
          a_response text, b_response text,      -- null | accept | decline
          decline_reason text,                   -- not_now | not_interested | null
          why_a text, why_b text, icebreakers jsonb,   -- text[] of exactly 3 conversation starters
          score float,
          venue jsonb, plan_reason text, tool_calls jsonb,
          created_at timestamptz, expires_at timestamptz)
ai_cache(key text pk, value jsonb)        -- hash of prompt -> response (also hand-seeded fallbacks)
```
Constraints:
- A user may be in at most ONE proposal with state `pending` or `both_accepted`. Enforce in a transaction (lock both users' presence rows) plus a check before insert.
- Cooldown: do not match a pair that has any proposal in the last 10 minutes (demo: 2 minutes) unless it was `confirmed`.

Follow relationship from A's view of B (derived):
`close_friends` (A has B as close friend) > `mutual` (both follow) > `following` (A follows B) > `follows_you` (B follows A) > `none`.
A candidate passes a user's filter if their relationship is in that user's `follow_statuses` (or `anyone` is included).

## 4. Matching pipeline (`/lib/matching.ts`)
`runMatchForUser(userId)`; called after `POST /api/presence` and also from `GET /api/proposal` when the user has no active proposal (rate-limit: once per 3s per user).
1. **Hard filters (SQL/TS):** both active and not expired; within BOTH users' radius; each passes the OTHER's filters (age, gender, follow status); not in an active proposal; not blocked; not in cooldown.
2. **Soft score (0-1):** weighted tag overlap (exact match = full weight, `adjacent_tags` = half), small bonus for follow relationship (`mutual`/`close_friends` +0.1) if user's filters include it. Threshold 0.35. Take top 3.
3. **LLM rerank (Muse Spark, top 3 only):** `rerankCandidates` below. Result creates the proposal for BOTH users in one insert.

## 5. Proposal state machine
```
pending --(both accept)--> both_accepted --(venue plan saved)--> confirmed
pending --(either declines)--> declined
pending --(now > expires_at)--> expired
```
- `expires_at = created_at + 45s` (const `PROPOSAL_TTL_SECONDS`, default 45; production would be 120-180).
- Expiry is enforced lazily: every `GET /api/proposal` and every respond call first expires stale proposals.
- On `declined` or `expired`: set both presences available again, write cooldown (via the proposal row), then call `runMatchForUser` for both so they get new suggestions.
- `decline_reason = not_interested` should lower that pair's score to zero for good (hard exclude); `not_now` only triggers cooldown.
- Only the first response from each side counts. Responding to a non-pending proposal returns 409.

## 6. API contract
All requests carry `user_id` (mock auth: "Continue as Maya" sets it in localStorage).

### GET /api/users  (sim + login screen)
`200 [{ "id":"maya", "name":"Maya", "handle":"maya.climbs", "age":24, "gender":"woman", "avatar_url":"...", "verified":true }]`

### PUT /api/interests
Req: `{ "user_id":"maya", "text":"I climb, make bad lo-fi beats, and hunt for ramen" }`
Res: `{ "tags":[{"tag":"bouldering","category":"sport","weight":0.9}, {"tag":"music production","category":"creative","weight":0.7}, {"tag":"ramen","category":"food","weight":0.6}], "adjacent_tags":["hiking","indie music","coffee"] }`

### PUT /api/filters
Req: `{ "user_id":"maya", "age_min":21, "age_max":30, "genders":["woman","man","nonbinary"], "follow_statuses":["mutual","following","anyone"], "radius_mi":1 }`
Res: `{ "ok":true }`

### POST /api/presence
Req: `{ "user_id":"maya", "lat":30.2849, "lng":-97.7341, "minutes":120 }`  (also used by the sim when a pin is dragged; reuse the existing `available_until` if not provided)
Res: `{ "active":true, "available_until":"2026-10-25T01:00:00Z" }`
Without `minutes` (pin drag), only the position changes: an unexpired `available_until` is kept; otherwise the user stays off and the response is `{ "active":false, "available_until":null }` (dragging a pin never switches someone on).
`DELETE /api/presence?user_id=maya` turns the feature off. Res: `{ "ok":true, "active":false }`.
Errors (all endpoints): `400 { ok:false, error }` for a bad body, `404` for an unknown `user_id`.

### GET /api/proposal?user_id=maya   (poll every 1.5s)
Res when nothing: `{ "proposal": null, "searching": true }` (`"searching": false` if the user's "Meet nearby" is off or its window ran out).
The first match for a pair takes a few seconds (AI call, runs after the response); the UI just keeps polling. `shared_tags` lists real overlaps: exact matches first, then adjacent ones. A `confirmed` proposal stays visible while the user is still on.
Res when active (A's view; B's view is mirrored, so `why` is the text written for the requesting user):
```
{ "proposal": {
    "id":"c0ffee...", "state":"pending",
    "other": { "name":"Jordan", "handle":"jordan.boulders", "age":25, "avatar_url":"...", "verified":true,
               "relationship":"mutual", "distance":"nearby" },
    "why":"You both climb and love ramen. Jordan has been to Crux Climbing too.",
    "shared_tags":["bouldering","ramen"],
    "icebreakers":["What's the hardest V-grade you've sent?", "How did you first get into bouldering?", "What's your go-to coffee order after a session?"],  -- exactly 3, spoken in person (no chat feature)
    "my_response": null, "other_responded": false,   -- do NOT leak the other's actual answer while pending
    "expires_at":"2026-10-24T23:41:45Z", "server_now":"2026-10-24T23:41:00Z",
    "venue": null, "plan_reason": null, "tool_calls": null } }
```
When `state` is `both_accepted` the plan is generating (UI shows "Finding a spot..."). When `confirmed`: `venue` = `{ "id","name","address","category","lat","lng","open_until" }`, plus `plan_reason` and `tool_calls` (for the AI panel).

`tool_calls` is an ordered array, one entry per tool the venue agent called (the same shape is stored in `proposals.tool_calls`):
```
[ { "step": 1, "tool": "get_nearby_venues", "args": { "lat":30.29, "lng":-97.74, "radius_m":1200, "category":"cafe" },
    "result": [ { "id":"spider-house", "name":"Spider House Cafe", "category":"cafe", "distance_m":610 } ] },
  { "step": 2, "tool": "get_open_hours", "args": { "venue_id":"spider-house", "time":"2026-10-24T23:41:20Z" },
    "result": { "open": true, "closes_at":"2026-10-25T07:00:00Z" } },
  { "step": 3, "tool": "propose_plan", "args": { "venue_id":"spider-house", "reason":"..." }, "result": { "ok": true } } ]
```
`step` starts at 1 and is at most 5; `tool` is one of the three tools in section 7; `args` and `result` are exactly what was passed to and returned from the tool. Example file: `/data/mock/proposal-confirmed.json`.
When `declined`/`expired`: `{ "proposal": null, "last_outcome":"expired"|"declined" }` once, then searching again.

### POST /api/proposal/:id/respond
Req: `{ "user_id":"maya", "response":"accept"|"decline", "reason":"not_now"|"not_interested" }`
Res: `{ "state":"pending"|"both_accepted"|"declined", "ok":true }`

### POST /api/sim/reset
Clears proposals and cooldowns, reseeds personas. Used before each demo take.

### Safety stubs (UI-only, return `{ok:true}`)
`POST /api/block {user_id, blocked_id}`, `POST /api/report {user_id, reported_id, reason}`, `POST /api/share-plan {user_id, friend_handle}`, `POST /api/checkin {user_id, status:"here"|"leaving"}`.

## 7. AI functions (`/lib/ai.ts`)
All calls: JSON output only, validate with zod, on failure or timeout (8s) use `ai_cache` fallback (seed fallbacks for every demo persona). Cache by hash of input. Only call the model on shortlists.

1. `extractTags(text) -> { tags:[{tag,category,weight}], adjacent_tags:[string] }`
   Normalize to lowercase canonical tags (e.g. "bouldering" not "I climb rocks"). Max 8 tags.
2. `rerankCandidates(me, candidates[3]) -> { chosen_id, why_for_me, why_for_them, icebreakers[3] }`
   `icebreakers` are 3 short, distinct questions about shared interests that work face to face. `why_for_*` is 1-2 friendly sentences, second person, references real shared tags only. No invented facts, no mention of exact location.
3. `planMeetup(a, b, now) -> { venue_id, reason, tool_calls[] }`
   Tool-calling loop (max 5 steps). Tools run against `/data/venues.json`:
   - `get_nearby_venues({ lat, lng, radius_m, category? })` -> venues near the MIDPOINT of the two users
   - `get_open_hours({ venue_id, time })` -> `{ open: bool, closes_at }`
   - `propose_plan({ venue_id, reason })` -> ends the loop
   Constraints in the system prompt: public place only, open now for at least 90 more minutes, fits shared interests, prefer cafes/parks for a first meeting. Every tool call and result is saved to `proposals.tool_calls` for the AI panel in the demo.

## 8. Data files
- `/data/venues.json`: ~15 REAL public places near campus/downtown: `{ id, name, address, category, lat, lng, tags[], hours:{ open:"07:00", close:"22:00", overrides?:{ mon|tue|...|sun: {open,close} | null } } }`. `open`/`close` apply every day; an override replaces them for one day, `null` = closed. `"24:00"` means midnight. (Internal to the backend; the `venue` object sent to clients is unchanged.)
- `/data/personas.json`: 8-10 seed users (see below) + follows edges.

Seed personas (spread across 3 map clusters so some are in range and some are not):
| id | name | interests (raw) | notes |
|---|---|---|---|
| maya | Maya, 24 | climbing, lo-fi beats, ramen | demo user A |
| jordan | Jordan, 25 | bouldering, coffee, film photography | demo user B, mutual follow with Maya |
| sam | Sam, 23 | pickup soccer, board games, ramen | decoy: decline-then-new-match |
| riley | Riley, 26 | hiking, birding, sourdough | decoy |
| devon | Devon, 31 | startup, running, cold plunge | out of Maya's age filter |
| priya | Priya, 22 | bouldering, matcha, sketching | second match after decline |
| plus 2-4 more | | | one far away (out of radius) |

## 9. UI contract (Person 2)
Screens: Login ("Continue as ..."), Home/Meet nearby (toggle + "open for 2 hrs" timer), Interests (chips + free text, shows extracted tags), Filters, Proposal card (avatar, why, shared tags, countdown ring, Accept/Not now/Not interested), Confirmed (venue, mini map, conversation starters, "Share my plans" (pick a friend, Send, then "Send update"), status On my way / I've arrived / Heading home, Report/Block), Post-meetup feedback (UI only), `/sim` (map with draggable pins, per-user "open as" buttons, reset button), AI panel (collapsible: extracted tags, match reasoning, venue agent tool calls). Show a visible "18+ only, public places only, verified" note on the toggle screen. Mobile-first at ~390px width, Instagram look (white, thin icons, gradient accent).

## 10. Definition of done for the demo path
Two browser windows (Maya, Jordan). Both online -> both get the same proposal within ~2s -> Maya declines (or lets it expire) -> new proposal with Priya appears -> accept both -> venue agent runs, tool calls visible -> confirmed screen on both. `POST /api/sim/reset` returns to the start state.