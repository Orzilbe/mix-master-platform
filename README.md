# Mix Master Platform

> A daily mini-game hub with weekly competitions. Players must be physically present at a venue to access the game. Scores are saved automatically and a weekly champion is crowned every Sunday.

---

## 1. Overview

Mix Master Platform is a Next.js 14 web app that wraps the [Mix Master Arena](https://github.com/Orzilbe/graffiti-io) graffiti game in a competitive weekly league. Players sign up, show up to a physical location, play, and climb the leaderboard. Every Monday the week resets and the previous week's top scorer is archived as champion.

**Key features:**
- Clerk authentication (sign-up, sign-in, email verification)
- Location gate — Haversine distance check blocks access unless the player is within the configured venue radius
- Automatic score capture via `postMessage` from the embedded game iframe
- Weekly leaderboard with live countdown, plus an all-time leaderboard
- Weekly champion archived every Sunday via a Postgres function
- Admin panel to set the active venue coordinates and radius

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Auth | Clerk v5 |
| Database | Supabase (PostgreSQL + Row-Level Security) |
| Styling | Tailwind CSS, Permanent Marker + Boogaloo fonts |
| Game | [graffiti-io / Mix Master Arena](https://github.com/Orzilbe/graffiti-io) (embedded iframe) |

---

## 3. Requirements

- **Node.js** v18 or higher
- A **Clerk** account → [clerk.com](https://clerk.com)
- A **Supabase** project → [supabase.com](https://supabase.com)
- The [Mix Master Arena game](https://github.com/Orzilbe/graffiti-io) deployed (or running locally)

---

## 4. Installation

```bash
git clone <this-repo>
cd mix-master-platform
npm install
```

---

## 5. Environment Variables

Create a `.env.local` file in the project root:

```env
# ── Clerk ─────────────────────────────────────────────────────────────────────
# Dashboard → your app → API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/hub
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/hub

# ── Supabase ───────────────────────────────────────────────────────────────────
# Dashboard → your project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # server-only, never exposed to browser

# ── Game embed ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_GAME_URL=https://mix-master-8gh1.onrender.com/display

# ── Venue location gate (leave blank to disable) ──────────────────────────────
VENUE_LAT=
VENUE_LON=
VENUE_RADIUS_M=100
```

### Where to get each key

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys → Publishable key |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys → Secret key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |
| `NEXT_PUBLIC_GAME_URL` | URL of your deployed graffiti-io `/display` page |
| `VENUE_LAT` / `VENUE_LON` | Google Maps — right-click any location → copy coordinates |

---

## 6. Database Setup

Run the schema once in the **Supabase SQL Editor** (Dashboard → SQL Editor → New query):

```
Paste the contents of supabase/schema.sql and click Run
```

This creates:

| Object | Type | Purpose |
|---|---|---|
| `players` | Table | One row per user, linked to Clerk `clerk_id` |
| `game_sessions` | Table | Every completed game with score and timestamp |
| `weekly_leaderboard` | View | Aggregated scores grouped by ISO week |
| `weekly_champions` | Table | Archived champion per week |
| `locations` | Table | Active venue coordinates set by admin |
| `archive_weekly_champion()` | Function | Archives last week's top player |

**Optional — automate champion archiving with pg_cron:**

In the Supabase SQL Editor:
```sql
SELECT cron.schedule(
  'archive-weekly-champion',
  '5 0 * * 1',   -- every Monday at 00:05 UTC
  'SELECT archive_weekly_champion()'
);
```

---

## 7. Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| URL | Description |
|---|---|
| `/` | Landing page — champion + top 3 preview |
| `/register` | Sign up with email verification |
| `/login` | Sign in |
| `/hub` | Game hub — today's game card + weekly standings |
| `/hub/play` | Embedded game + automatic score capture |
| `/leaderboard` | This week / last week / all-time rankings |
| `/profile` | Your stats and recent game history |
| `/admin` | Set venue coordinates (any signed-in user for now) |

---

## 8. How Score Saving Works

1. Player opens `/hub/play` — the Mix Master Arena game loads in an `<iframe>`
2. Player scans a QR code from the game display to join as a controller on their phone
3. When the game ends, `game.js` in the Arena fires:
   ```js
   window.parent.postMessage({ type: 'mix-master-game-end', scores: [...] }, '*')
   ```
4. The platform's `/hub/play` page listens for this message and matches the player by their **Clerk username** (case-insensitive)
5. If matched, `POST /api/scores` is called — the score is saved to Supabase
6. A toast confirms the save, or warns if the name didn't match

> **Important:** players must enter their exact platform username when joining a game controller slot.

**Score unit:** territory percentage × 10, stored as an integer (0–1000). Displayed as `score ÷ 10` with one decimal, e.g. 453 → `45.3%`.

---

## 9. Location Gate

When `VENUE_LAT` and `VENUE_LON` are set, the `/hub/play` page checks the player's browser geolocation against the venue using the Haversine formula via `POST /api/check-location`. Players outside `VENUE_RADIUS_M` metres see a "Too Far Away" screen.

- Leave `VENUE_LAT` / `VENUE_LON` blank to disable the gate (everyone can access)
- If the user denies geolocation permission, they are let through
- Venue coordinates can be updated at any time from `/admin`

---

## 10. File Structure

```
mix-master-platform/
│
├── app/
│   ├── page.tsx                    # Landing — champion + top 3 + CTA
│   ├── layout.tsx                  # Root layout — ClerkProvider, fonts
│   ├── globals.css                 # Tailwind base + global resets
│   │
│   ├── login/[[...rest]]/page.tsx  # Clerk <SignIn> (catch-all for sub-steps)
│   ├── register/[[...rest]]/page.tsx
│   │
│   ├── hub/
│   │   ├── layout.tsx              # Syncs Clerk user → Supabase on entry
│   │   ├── page.tsx                # Game cards + weekly standings sidebar
│   │   └── play/page.tsx           # Iframe embed + postMessage score handler
│   │
│   ├── leaderboard/page.tsx        # This week / last week / all-time
│   ├── profile/page.tsx            # Stats + recent game history
│   ├── admin/
│   │   ├── page.tsx                # Venue location form
│   │   └── actions.ts              # Server Action — saves location to Supabase
│   │
│   └── api/
│       ├── check-location/route.ts # POST — Haversine distance check
│       └── scores/route.ts         # POST — save a game session (auth-gated)
│
├── components/
│   ├── Navbar.tsx                  # Logo + nav links + NavbarUser
│   ├── NavbarUser.tsx              # Client — Clerk username + UserButton
│   ├── GameCard.tsx                # Clickable game tile
│   ├── LeaderboardTable.tsx        # Ranked rows with medals
│   ├── WeeklyChampion.tsx          # Last week's champion banner
│   ├── WeeklyStandings.tsx         # Sidebar — live countdown + top 10
│   └── LocationGate.tsx            # Client — geolocation check wrapper
│
├── lib/
│   ├── supabase.ts                 # Public client + supabaseAdmin() factory
│   ├── db.ts                       # All DB helper functions
│   └── types.ts                    # TypeScript interfaces for DB rows
│
├── supabase/
│   └── schema.sql                  # Full schema — run once in Supabase SQL Editor
│
├── public/
│   └── logo.png                    # Mix Master logo
│
├── middleware.ts                   # clerkMiddleware — public/protected route rules
├── tailwind.config.ts              # Custom palette: mm-bg, mm-pink, mm-cyan, etc.
└── .env.local                      # Environment variables (not committed)
```

---

## 11. Deploying

### Vercel (recommended)

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add all `.env.local` variables as Environment Variables in the Vercel dashboard
4. Deploy — Vercel auto-detects Next.js

### Environment variables on Vercel

Add each key from `.env.local` under **Settings → Environment Variables**. Make sure `SUPABASE_SERVICE_ROLE_KEY` is set to **Server** scope only (not exposed to the browser).

---

## 12. Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 14 | Framework (App Router) |
| `@clerk/nextjs` | 5 | Authentication |
| `@supabase/supabase-js` | 2 | Database client |
| `tailwindcss` | 3 | Styling |
| `framer-motion` | 12 | Animation (available, used in future iterations) |
| `lucide-react` | latest | Icon library (available, used in future iterations) |

---

*Built with Next.js 14, Clerk, Supabase, and the Canvas 2D API.*
