# OpenSkyLight

An open-source, fully standalone family calendar display — a [Skylight Calendar](https://myskylight.com) alternative with no subscription, no cloud account, and no Home Assistant. One Electron app owns the whole touchscreen: calendar, family member color coding, and (coming milestones) Google sync, weather, chores, rewards, lists, meals, and a photo screensaver.

## Status

**M0 – M5 complete** — calendar, sync, weather, parental lock, chores & rewards, lists & meals:

- Week / Day / Month / Agenda (List) views, touch-first with ≥48px targets
- Family member profiles with per-person colors and filter chips
- Local calendars with full event create/edit/delete from the screen
- Recurring events (daily/weekly/monthly/yearly, weekday picker, end date) with
  Google-style **this / this-and-following / all** edit and delete scopes
- **Two-way Google Calendar sync**: loopback OAuth with PKCE (your own free
  Google Cloud credentials), incremental pull with sync tokens (60s polling),
  push of local edits with If-Match etags and last-writer-wins conflict
  resolution, person assignments round-tripped via extended properties
- **ICS feed subscriptions** (read-only, conditional GET, 30-minute refresh)
- **Weather header** via Open-Meteo (no API key): current conditions next to the
  date, tap for a 5-day forecast; city search and °F/°C in settings
- **Parental PIN lock** (scrypt-hashed, enforced in the main process): settings,
  calendar/people management, and sync configuration sit behind a 4–8 digit PIN
- **Chores & routines**: per-child daily/weekly/one-time chores grouped into
  morning/evening routines on a per-person chore board with big tap-to-check
  circles; parents manage definitions behind the PIN
- **Star rewards**: completed chores earn stars (append-only ledger, balance is
  always the sum); kids redeem rewards from the board, parents approve pending
  redemptions in settings
- **Custom lists** (groceries, to-dos, anything): color-coded cards with
  tap-to-check items, clear-done, shared by the whole family
- **Meal planning**: breakfast/lunch/dinner/snack per day, edited from a tap on
  the meal strip in the Week and Day views
- Built-in on-screen keyboard (no reliance on the Windows touch keyboard)
- Warm "paper planner" visual design (Fraunces + Nunito, linen + ember palette)

### Connecting Google Calendar

1. Create a free Google Cloud project, enable the **Google Calendar API**
2. Configure an OAuth consent screen (External, add yourself as a test user)
3. Create an OAuth client of type **Desktop app**
4. In the app: Settings → Calendars → paste the client ID + secret → Save & connect
5. Sign in via the browser window that opens, then choose which calendars to sync

### Roadmap

- **M6** — Photo screensaver, sleep schedule, auto-launch, installers
- Later: recipe storage, drag-to-reorder lists, AI imports (Magic Import-style)

## Development

```bash
npm install        # also rebuilds better-sqlite3 for Electron
npm run dev        # windowed dev mode with hot reload
npm run dev -- --kiosk   # fullscreen kiosk in dev
npm test           # unit tests (run inside Electron's Node for the native module)
npm run typecheck
node scripts/e2e-smoke.mjs   # launches the built app and creates an event end-to-end
npm run dist       # NSIS installer + portable exe (Windows)
```

Production builds run fullscreen kiosk by default; pass `--windowed` to opt out.
Data lives in SQLite at `%APPDATA%/openskylight/openskylight.db`.

## Architecture

- **Electron + React 19 + TypeScript**, bundled with electron-vite
- **SQLite (better-sqlite3 + Drizzle)** in the main process is the single source of truth
- Renderer is fully sandboxed; all access goes through a **typed IPC contract**
  (`src/shared/ipc/contract.ts`) with zod validation at the main-process boundary
- Recurrence is stored as RRULE masters + exception rows and expanded at query
  time in `src/shared/recurrence/expand.ts` (rrule + Luxon, DST-safe, heavily unit-tested)
- State: TanStack Query over IPC + Zustand for view state
