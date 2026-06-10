# OpenSkyLight

An open-source, fully standalone family calendar display — a [Skylight Calendar](https://myskylight.com) alternative with no subscription, no cloud account, and no Home Assistant. One Electron app owns the whole touchscreen: calendar, family member color coding, and (coming milestones) Google sync, weather, chores, rewards, lists, meals, and a photo screensaver.

## Status

**M0 + M1 complete** — a usable local family calendar:

- Week / Day / Month / Agenda (List) views, touch-first with ≥48px targets
- Family member profiles with per-person colors and filter chips
- Local calendars with full event create/edit/delete from the screen
- Recurring events (daily/weekly/monthly/yearly, weekday picker, end date) with
  Google-style **this / this-and-following / all** edit and delete scopes
- Built-in on-screen keyboard (no reliance on the Windows touch keyboard)
- Warm "paper planner" visual design (Fraunces + Nunito, linen + ember palette)

### Roadmap

- **M2** — Two-way Google Calendar sync (your own OAuth credentials), ICS feeds
- **M3** — Weather header (Open-Meteo), full settings, parental PIN lock
- **M4** — Chores, routines, star rewards
- **M5** — Lists, recipes, meal planning
- **M6** — Photo screensaver, sleep schedule, auto-launch, installers

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
