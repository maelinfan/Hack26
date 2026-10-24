# Project context
Hackathon project (HackTX 2026, Meta track: "Bringing people closer together with AI"). Deadline: 11:30 am Oct 25. Team of 2, vibe coding.
Judged on: human connection (30%), essential AI integration (25%), originality (20%), working demo video (20%).

Product: an Instagram-style feature that matches nearby people with similar interests and prompts BOTH to meet at an AI-chosen public venue. Full contract is in SPEC.md. READ SPEC.md AND PROGRESS.md BEFORE DOING ANYTHING.

# Ownership
- Person 1 (backend + AI) owns: /lib, /app/api, /data, /supabase
- Person 2 (frontend, simulator, demo) owns: /app/(ui), /components, /app/sim, and /data/mock
- Never edit the other person's folders. If a change is needed there, tell the user so they can coordinate, or we update SPEC.md.

# Personal context
@ME.md

# Rules
- Match the JSON shapes in SPEC.md section 6 exactly. Until the backend exists, use fake data in /data/mock/*.json (create it if missing, but ask me before changing anything in /data other than /data/mock).
- Stack: Next.js App Router, TypeScript, Tailwind. Mobile-first (~390px), Instagram look: white background, thin icons, gradient accent.
- Keep edits small and focused on one task at a time. Don't refactor things I didn't ask about.
- Don't add new dependencies without asking.
- Commit-friendly: after each working change, tell me what to test.
- Never print or commit secrets. API keys live in .env.local only.

# Commands
npm run dev (dev server), npm run build (type check), git add/commit often.