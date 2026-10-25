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
## In progress
(nothing)
## Next (Person 2)
1. Interests editor, Filters screen
2. Confirmed screen, /sim page with draggable pins and "open as" buttons (needed for the Jordan window)
3. AI panel
## Notes / decisions
- Node installed via winget; a terminal opened before install needs a restart to see `node`.
- Login always signs in as Maya. Other personas (e.g. Jordan) will be opened from /sim.
- Mock proposal timestamps are fixed; the UI must rewrite `expires_at`/`server_now` relative to now for the countdown.
- Edits outside Person 2 folders: deleted starter app/page.tsx; app/layout.tsx title; app/globals.css (removed dark mode, Geist font).
- AGENTS.md was added by create-next-app (delete if unwanted).
