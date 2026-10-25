# Progress (update every hour or after each feature)
## Done
- SPEC.md written
- Next.js scaffold (App Router, TS, Tailwind 4), builds clean
- Mock data in /data/mock: users.json (10 users), proposal-pending/confirmed/none.json
- `tool_calls` shape added to SPEC.md section 6
- App shell: /app/(ui) layout (430px column), BottomNav (Home, Meet nearby), AuthGate, useSession (localStorage `user_id`)
- Login: single "Connect your Meta account" button, signs in as Maya (mock auth)
- Home placeholder (avatar, handle, Log out); /nearby is a placeholder
- /nearby: Meet nearby toggle, 30 min / 1 hr / 2 hrs duration picker, live countdown (fake state, no API), "18+ only, public places only, verified" note; added ShieldCheckIcon to Icons
- Proposal card (components/ProposalCard.tsx): mock proposal-pending.json, 45s gradient countdown ring (TTL rebased to now), expired state, Accept -> "Waiting for them...", Not now / Not interested dismiss; added CheckBadgeIcon. Shown on /nearby 4s after turning the toggle on (fake, no API). Not now / Not interested / expiry (after 2.5s notice) advance to the next fake candidate (Jordan, Priya, Sam, Riley, Ava; own persona skipped). Local-only stand-in for server rematching; real flow shows both users the same proposal via the API
- Interests editor (/nearby/interests): chips tap-to-remove, custom input, suggested tags, cap 8 (SPEC "max 8 tags"). Stored as string[] in localStorage `interests:<user_id>` (no extractTags yet; the API takes free text and returns tags)
- Filters (/nearby/filters): age 18-65 sliders (18 min enforced), genders, follow_statuses, radius_mi (0.25-1 mi). Stored in localStorage `filters:<user_id>` using SPEC field names; Save requires at least one gender and follow status. Helpers in components/nearbyPrefs.ts, header in components/SubHeader.tsx. Reached via "Interests"/"Filters" rows on /nearby
- Confirmed screen (/nearby/confirmed): mock proposal-confirmed.json with timestamps rebased to now (components/mockTime.ts), avatars + verified badge, venue card with SVG mini map + "Open in Maps" link, plan_reason, icebreaker with Copy, UI-only safety (Share my plans, I'm here/leaving, Report/Block sheets), post-meetup feedback sheet. Temporary "Preview confirmed screen" link at bottom of /nearby (remove when real flow is wired). Added ChevronDownIcon, CopyIcon, StarIcon
- AI panel (components/AIPanel.tsx): collapsible "How AI picked this" with extracted tags (loadInterests), match reasoning (why, shared_tags, score), venue agent tool_calls step list (tap for raw JSON; hidden when null). On Confirmed (all sections) and under ProposalCard (sections 1-2)
- Confirmed screen revisions: Copy button removed; 3 "Conversation starters" (SPEC now has `icebreakers[3]`, mock files updated); safety flow reworked (pick friend -> Send -> "Sent!" -> Send update; status On my way / I've arrived / Heading home auto-updates the friend); venue closing times snap to the next full hour in mocks
- Backend Phase 1 (Person 1): /data/personas.json (10 users, follows, filters, presence), /data/venues.json (15 Austin venues), /lib/types.ts, /lib/db.ts (Supabase client), GET /api/users (matches /data/mock/users.json), temporary GET /api/health
- Backend Phase 2 (Person 1): Supabase schema (supabase/schema.sql, 6 tables), POST /api/sim/reset (seeds personas), GET /api/users now reads the DB (identical to mock)
- Backend Phase 3 (Person 1): PUT /api/filters, POST/DELETE /api/presence, safety stubs (block, report, share-plan, checkin); zod added for request validation. Live now: Person 2 can call these instead of localStorage
- Backend Phase 4 (Person 1): /lib/ai.ts extractTags (cache -> model -> keyword fallback, zod-validated, 8s timeout), PUT /api/interests (saves tags on the user), /api/sim/reset seeds ai_cache for the demo personas. Real model call untested until MODEL_API_KEY is set
- Backend Phase 5 (Person 1): matching (/lib/matching.ts: hard filters, score, top 3), rerankCandidates (model, template fallback, cached), GET /api/proposal (mirrored view, no coordinates/answer leaks, last_outcome once, lazy expiry + rematch). POST /api/presence now starts a search after responding. Real Muse Spark calls verified. Try it: Maya + Jordan + Priya online -> Maya/Jordan proposal; let it expire -> Maya gets Priya
## In progress
- Backend Phase 6: POST /api/proposal/:id/respond (accept/decline/state machine), DELETE presence ends proposals
## Next (Person 2)
1. /sim page with draggable pins and "open as" buttons (needed for the Jordan window)
## Notes / decisions
- Node installed via winget; a terminal opened before install needs a restart to see `node`.
- Login always signs in as Maya. Other personas (e.g. Jordan) will be opened from /sim.
- Mock proposal timestamps are fixed; the UI must rewrite `expires_at`/`server_now` relative to now for the countdown.
- Edits outside Person 2 folders: deleted starter app/page.tsx; app/layout.tsx title; app/globals.css (removed dark mode, Geist font).
- AGENTS.md was added by create-next-app (delete if unwanted).
