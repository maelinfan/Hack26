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
## In progress
(nothing)
## Next (Person 2)
1. Proposal card with countdown (mock data)
2. Interests editor, Filters screen
3. Confirmed screen, /sim page with draggable pins and "open as" buttons (needed for the Jordan window)
4. AI panel
## Notes / decisions
- Node installed via winget; a terminal opened before install needs a restart to see `node`.
- Login always signs in as Maya. Other personas (e.g. Jordan) will be opened from /sim.
- Mock proposal timestamps are fixed; the UI must rewrite `expires_at`/`server_now` relative to now for the countdown.
- Edits outside Person 2 folders: deleted starter app/page.tsx; app/layout.tsx title; app/globals.css (removed dark mode, Geist font).
- AGENTS.md was added by create-next-app (delete if unwanted).
