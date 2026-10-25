# Nearby

**Put the phone down. Say hi in person.**

Nearby is an Instagram feature that finds someone close by who shares your interests, then gets you both to a real public place, face to face. There's no chat to get lost in and no endless scrolling. It's two people, a good reason to talk, and a coffee shop a few minutes away.

> Built at HackTX 2026 for the Meta track: *Bringing people closer together with AI.*

| | |
|---|---|
| **Demo video** | _TODO: link_ |
| **Devpost** | _TODO: link_ |
| **Live demo** | _TODO: link_ |

## Screenshots

| Meet nearby | Proposal | Confirmed plan | AI panel |
|---|---|---|---|
| _TODO: screenshot_ | _TODO: screenshot_ | _TODO: screenshot_ | _TODO: screenshot_ |

## The problem

We're more connected online than ever, and lonelier than ever. Social apps are good at keeping us on our screens and bad at getting us in the same room. Most of us have a lot of people nearby we'd get along with and never meet.

## What Nearby does

1. **Turn on "Meet nearby"** for a certain amount of time. Set your interests and who you're open to meeting (age, gender, follow status, radius).
2. **We find one good match nearby;** someone who passes both of your filters and shares real interests with you.
3. **Both of you see the same proposal at the same time**, with a 45-second countdown and a short, friendly reason why you two should meet.
4. **Both accept, and an AI agent picks a public place.** It's a cafe or park that's open, near the midpoint between you, and fits what you share.
5. **You get a plan and three conversation starters** to use in person. You can share your plans with a friend and check in as "on my way", "I've arrived" or "heading home".

If either person says no, both are released and a new match is found. If someone picks "not interested", that pair is never matched again.

### Built for face-to-face

- **No chat.** The only way to talk to your match is to show up.
- **Public places only.** The venue agent can't propose anywhere private, and it only picks places that are open for at least 90 more minutes.
- **18+ only and verified.** This is stated on the toggle screen.
- **Privacy by design.** We never send one user's coordinates to another client, only a "very close" or "nearby" bucket.
- **Safety built in.** There's plan sharing, check-ins, and block and report.

## Where the AI is essential

Take the AI out and this isn't the same product. Muse Spark (Meta) does four jobs:

| Step | What the model does |
|---|---|
| **Interest understanding** | Turns free text like *"I climb, make bad lo-fi beats, and hunt for ramen"* into canonical tags (`bouldering`, `music production`, `ramen`) plus adjacent interests for fuzzy matching. |
| **Match reranking** | Looks at the top 3 candidates that survived filtering and scoring, picks the best one for this moment, and writes a personal "why you two" for each person. It only uses real shared tags and never invents facts. |
| **Conversation starters** | Writes 3 questions about your shared interests that work out loud, face to face. |
| **Venue agent** | A tool-calling loop (`get_nearby_venues` → `get_open_hours` → `propose_plan`) that picks a real place near your midpoint. Every tool call is saved and shown in the app's "How AI picked this" panel. |

The AI is also built to be reliable:

- All output is JSON validated with zod.
- Calls have an 8-second timeout.
- Responses are cached.
- There are deterministic fallbacks (keyword tags, template reasons, a code-based planner), so the demo never hangs.
- A hard cap on paid model calls keeps costs bounded.

## How it works

```
Presence + filters ──► Hard filters ──► Soft score (tag overlap) ──► Top 3 ──► LLM rerank
                       (radius, age,     (exact = 1, adjacent        │
                        gender, follow,   = 0.5, follow bonus)       ▼
                        cooldown, ...)                          One proposal for BOTH users
                                                                     │ both accept
                                                                     ▼
                                                      Venue agent (tool calling) ──► Confirmed plan
```

The proposal moves through `pending → both_accepted → confirmed`, or ends as `declined` or `expired`. Expiry is checked lazily on every poll. Clients poll every 1.5 seconds, so there are no websockets.

Location is simulated for the demo. There's no GPS, and each user's position is set by dragging a pin on the `/sim` map.

## Tech stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS. It's mobile-first (~390px) and designed to look native to Instagram.
- **Backend:** Next.js API routes, Supabase (Postgres), zod for validation.
- **AI:** Muse Spark through an OpenAI-compatible API.

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (**required**)
- A Muse Spark API key (or any OpenAI-compatible model endpoint)

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root. Never commit it.

```bash
SUPABASE_URL=            # your Supabase project URL
SUPABASE_SERVICE_KEY=    # Supabase service role key (server-side only)
MODEL_API_KEY=           # model provider API key
MODEL_BASE_URL=          # e.g. https://api.meta.ai/v1
MODEL_NAME=              # e.g. muse-spark-1.1
```

Optional:

```bash
MODEL_MAX_CALLS=300      # hard cap on paid model calls (default 300)
PLAN_NOW=                # ISO time, e.g. 2026-10-25T18:00:00Z, pretends it's daytime
                         # for the venue agent (few venues are open at night)
```

### 3. Create the database

Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

### 5. Seed and warm up the demo

```bash
curl -X POST http://localhost:3000/api/sim/reset   # seed personas, clear proposals
curl -X POST http://localhost:3000/api/sim/warm    # pre-fill the AI cache (uses ~15 paid calls once)
```

You can check the status at `GET /api/sim/status`. It shows the database connection and the AI calls used.

## Try the demo

1. Open **`/sim`** on a desktop. It's a map with draggable pins for each persona.
2. Use "Open as" to open **Maya** and **Jordan** in two separate tabs.
3. Turn on **Meet nearby** in both tabs. Both see the same proposal within about 2 seconds.
4. Have Maya decline (or let it expire). She's matched with **Priya**.
5. Accept on both sides. The venue agent runs and its tool calls are visible.
6. Both land on the **confirmed** screen with a venue, a map and conversation starters.

Use **Reset** on `/sim` (or `POST /api/sim/reset`) before each run.

## Project structure

```
app/(ui)/      Mobile UI: home feed, Meet nearby, interests, filters, confirmed plan
app/sim/       Desktop simulator: map, draggable pins, open-as, reset
app/api/       REST API: users, interests, filters, presence, proposal, safety stubs
components/    Shared UI: proposal card, AI panel, stories, post cards, icons
lib/           Matching pipeline, AI functions, venue agent, db client, types
data/          Seed personas, real Austin venues, UI mock data
supabase/      Database schema
SPEC.md        Full product and API contract
PROGRESS.md    Build log
```

## Team

- **Maelin Fan**: frontend, simulator, demo
- **Akshaya Somasundaram**: backend, AI, demo

## Roadmap

- Real GPS and background presence instead of the simulated map
- Real Instagram identity, follow graph and verification
- Longer proposal windows (2 to 3 minutes) and push notifications
- Group meetups and recurring interest-based meetups
- Post-meetup feedback that feeds back into matching
- Integration into wearables (Meta Glasses)
