# Kitchen Skylight — Machine Setup Guide

This guide documents how to set up the kitchen skylight machine from scratch.
It's written for the specific hardware in this house (a Dell OptiPlex 7060),
but the steps apply to any always-on Windows touchscreen display.

## Hardware

| Component | Spec |
|---|---|
| **Machine** | Dell OptiPlex 7060 |
| **CPU** | Intel i5-8500T (6 cores, 2.1 GHz) |
| **RAM** | 8 GB |
| **Storage** | 512 GB PCIe SSD |
| **OS** | Windows 11 Pro |
| **Display** | 1920×1080 touchscreen |

## Prerequisites

- [Git](https://git-scm.com) (≥ 2.40)
- [Node.js](https://nodejs.org) LTS (≥ 20)
- [GitHub CLI](https://cli.github.com) (`gh`) — optional, for releases

## 1. Clone the repo

```bash
git clone https://github.com/arndvs/kitchen-skylight.git
cd kitchen-skylight
```

## 2. Install dependencies

```bash
npm install
```

> **Note:** On a fresh machine, npm may block native install scripts
> (Electron, better-sqlite3, esbuild, ffmpeg-static). If the Electron binary
> doesn't download, approve the scripts and reinstall:
>
> ```bash
> npm install-scripts approve electron better-sqlite3 esbuild ffmpeg-static
> npm install electron --force
> ```
>
> If the `@electron/get` downloader still fails (network/proxy), download the
> binary zip directly and extract it into `node_modules/electron/dist`, then
> write `path.txt` (containing `electron.exe`) and `dist/version` as plain
> ASCII.

## 3. Verify it works

```bash
npm run typecheck   # no errors
npm test            # all unit tests pass
npm run dev         # launches the app windowed with hot reload
```

## 4. Build the installer

```bash
npm run dist
```

This produces an NSIS installer and a portable exe in `dist/`.

> **Windows note — unsigned builds and the winCodeSign symlink error:** on a
> machine without Developer Mode, `npm run dist` can fail with
> *"Cannot create symbolic link: A required privilege is not held by the client"
>* icon (`winCodeSign/darwin/.../libcrypto.dylib`). electron-builder always
> extracts the code-signing toolkit even for unsigned builds, and it contains
> macOS symlinks Windows won't create without the `SeCreateSymbolicLinkPrivilege`
> (granted by Developer Mode). Fix: either enable **Developer Mode**
> (Settings → Privacy & Security → For developers) or build with the signing
> step disabled:
>
> ```bash
> ./node_modules/.bin/electron-builder --config.win.signAndEditExecutable=false
> ```
>
> The result is an unsigned installer (fine for personal, internal use).

## 5. Install on the kiosk

1. Run the installer from `dist/`.
2. In the app: **Settings → General → enable Launch on startup**.
3. Windows Settings → Accounts → enable **auto-login** (so the kiosk boots
   straight into the app after a power cut).
4. Windows Settings → System → Power: set the machine to **never sleep** (the
   app manages display dimming through its own sleep schedule).
5. The installed app runs **fullscreen kiosk** by default. To get a window for
   troubleshooting, launch `Kitchen Skylight.exe --windowed`.

## 6. First-run configuration

- **Family members:** Settings → People — add each family member with a color.
- **Google Calendar:** Settings → Calendars — paste your OAuth client ID/secret
  and connect (see README "Connecting Google Calendar").
- **Weather:** Settings → General — set your city for the header forecast.
- **Parental PIN:** Settings → set a 4–8 digit PIN to gate settings and
  management.
- **Companion app:** Settings → General → Companion app → enable, then pair
  phones by QR.

## 7. Backup

Follow [docs/BACKUP.md](BACKUP.md) — create a full disk image on an external
drive before heavy customization, then back up app data regularly.

## 8. Releases & auto-update

Installed apps check GitHub Releases every 6 hours and update themselves
silently at 03:30. To ship a new version:

```bash
npm version patch        # or minor/major
git push --follow-tags
```

The `Release` GitHub Action builds the installer, runs tests, and publishes the
release; every kiosk picks it up automatically.

## Troubleshooting

- **App won't launch / blank screen:** run `Kitchen Skylight.exe --windowed`
  to see errors in a window.
- **Phones can't reach the companion app:** allow Kitchen Skylight through
  **Windows Firewall** (Private networks).
- **Camera tiles show "unavailable":** the camera must provide an H.264 stream
  (set the camera substream to H.264).
- **Data location:** `%APPDATA%/kitchen-skylight/kitchen-skylight.db` (SQLite).