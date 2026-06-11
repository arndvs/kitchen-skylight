# OpenSkyLight

An open-source, fully standalone family calendar display — a [Skylight Calendar](https://myskylight.com) alternative with no subscription, no cloud account, and no Home Assistant. One Electron app owns the whole touchscreen: calendar, family member color coding, and (coming milestones) Google sync, weather, chores, rewards, lists, meals, and a photo screensaver.

## Status

**All planned milestones (M0 – M6) complete**, plus auto-update and a customizable home screen:

- **Customizable Home screen** (the default view): a 12×6 tile dashboard you
  arrange yourself — drag, resize, add, and remove tiles in a PIN-gated edit
  mode with snap-to-grid ghosts. Eleven tile types: today's events, this-week
  agenda, weather, chores progress, star balances, any list, today's meals,
  clock, cycling photos, news headlines, and live cameras. Tapping a tile
  jumps to its tab.
- **IP camera tiles (RTSP)**: add any camera's rtsp:// URL and watch it live on
  the home screen (~1s latency). The bundled ffmpeg remuxes the camera's H.264
  stream without transcoding (near-zero CPU) to a token-guarded localhost
  WebSocket; camera URLs (which contain credentials) are DPAPI-encrypted and
  never leave the main process. Cameras must provide an H.264 stream (set the
  camera substream to H.264 if tiles show "unavailable").

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
- **Photo screensaver**: point it at a folder of family photos; after the
  configured idle time it crossfades through them with a clock overlay (photos
  are served through a sandbox-safe custom protocol, never direct file access)
- **Sleep schedule**: the screen goes dark on a nightly window (overnight
  ranges supported), the display power-save blocker is released so the OS can
  power the panel down, and a tap wakes it for five minutes
- Launch-on-startup toggle, single-instance lock, crash auto-relaunch
- Built-in on-screen keyboard (no reliance on the Windows touch keyboard)
- Warm "paper planner" visual design (Fraunces + Nunito, linen + ember palette)
- **Dark mode that follows the sun**: by default the display switches to a warm
  dark palette at sunset and back at sunrise — sun times computed locally from
  your weather location (no network), falling back to 7pm–7am without one.
  Settings → General → Appearance also offers always-Light / always-Dark.

### Connecting Google Calendar

1. Create a free Google Cloud project, enable the **Google Calendar API**
2. Configure an OAuth consent screen (External, add yourself as a test user)
3. Create an OAuth client of type **Desktop app**
4. In the app: Settings → Calendars → paste the client ID + secret → Save & connect
5. Sign in via the browser window that opens, then choose which calendars to sync

### Ideas for later

Recipe storage, drag-to-reorder lists, portrait-layout pass, hard panel
power-off via the Win32 API, AI imports (Magic Import-style), companion
mobile/web access.

## Releases and auto-update

Installed apps check GitHub Releases every 6 hours (and shortly after boot).
Updates download in the background, show a "Restart now" pill on the display,
and install themselves silently at 03:30 if nobody taps it.

To ship a release:

```bash
npm version patch        # or minor/major — bumps package.json and creates the tag
git push --follow-tags
```

The `Release` GitHub Action builds the installer on a Windows runner, runs the
test suite, and publishes the release; every kiosk picks it up automatically.

## Kiosk setup (Windows)

1. `npm run dist`, then run the installer from `dist/` on the kiosk machine
2. In the app: Settings → General → enable **Launch on startup**
3. Windows Settings: set power options so the OS never sleeps (the app manages
   display dimming through its own sleep schedule), enable auto-login
4. The installed app runs fullscreen kiosk by default; launch with
   `OpenSkyLight.exe --windowed` if you ever need a window

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
