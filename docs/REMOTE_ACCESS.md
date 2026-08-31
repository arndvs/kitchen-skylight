# Reaching the Skylight from anywhere (Tailscale)

The companion app is served by the display itself on your home Wi-Fi (default
port 8420). On its own, a phone must be on the same network to reach it — until
you add **Tailscale**, which gives the kiosk and every family phone a private
encrypted mesh address that works from anywhere (home Wi-Fi, cellular, someone
else's house) with no port-forwarding and no public exposure.

The app already detects the Tailscale address: when Tailscale is running on the
kiosk, the companion settings show **“Reachable from anywhere”** and the pairing
QR uses the Tailnet address instead of the LAN IP.

> Threat model: inside your home, companion traffic is plain HTTP — fine for a
> home network. Tailscale wraps that traffic in an encrypted tunnel end-to-end,
> so the same plain-HTTP app is safe to reach from the open internet. You still
> pair once with a one-time QR token.

## 1. Install Tailscale on the kiosk (Windows)

1. Download the Windows client from <https://tailscale.com/download> and install
   it (Tailscale runs as a Windows service).
2. Sign in with the account that owns your **tailnet** (your Tailscale identity).
   Use the **magic login** link it opens.
3. Give the machine a friendly name if you like (e.g. `skylight`). Tailscale
   shows it as `skylight.<your-tailnet>.ts.net`.

You do **not** need an admin CLI to make it work with the app — the address is
auto-detected from the network interfaces. If you want to verify from a
terminal:

```bash
# Git Bash / PowerShell
tailscale ip -4      # prints the 100.x.y.z mesh address
```

4. Confirm it in the app: Settings → General → Companion app. If it's enabled,
   the status now reads **“Reachable from anywhere — Tailscale is on”**.

## 2. Install Tailscale on each phone

1. Install **Tailscale** from the App Store (iOS) or Play Store (Android).
2. Sign in with the same Tailscale identity (use the same account as the kiosk,
   or share the tailnet — the simplest family setup is everyone on one Tailscale
   identity or tailnet).
3. The phone's VPN shows **Connected**. That's it.

## 3. Pair the phone (same as before)

1. On the kiosk: Settings → General → Companion app → **Pair a phone**.
2. Scan the QR with the phone's camera. Because Tailscale is on, the URL is now
   the tailnet address (reachable from anywhere).
3. Use **Add to Home Screen** on the phone so it behaves like an app.

Now the phone can open the companion app from anywhere — check lists, chores,
and meals on the way home, in the parking lot, or from another city.

## 4. If the kiosk's QR still shows a LAN address

The Tailscale adapter wasn't detected. Check:

- Tailscale is **running and connected** on the kiosk (tray icon shows green).
- The kiosk's `100.x` adapter is up: `tailscale status`.
- After Tailscale connects, re-open Settings → General → Companion app — the
  status refreshes every few seconds.

If you intentionally don't want remote access, keep Tailscale off the kiosk:
the app simply shows **“LAN only”** and behaves exactly as before.

## 5. Security notes

- Tailscale authenticates the **device** (the phone/kiosk) with your identity;
  the companion app additionally authenticates the **pairing** with a one-time
  QR token. Both must be valid for a phone to read/edit anything.
- A paired phone can edit **lists, meals, chores, and read recipes** — it can
  never reach settings, sync credentials, cameras, or the parental PIN.
- To revoke a phone, use **Unpair all devices** in Settings (kiosk side), or
  remove the device from your Tailscale admin console.
- Deploying beyond family? Tailscale supports ACLs to restrict which devices can
  talk to the kiosk.

## Troubleshooting

- **Phone can't open the QR URL**: confirm the phone is connected to Tailscale
  (its VPN icon is on) and the kiosk is too. Without Tailscale on the phone, the
  `*.ts.net` address won't resolve.
- **Kiosk shows “Reachable from anywhere” but phone times out**: both must be on
  the same tailnet; check <https://login.tailscale.com/admin> for both devices.
- **Everything was fine on Wi-Fi but remote fails**: most likely the phone lost
  its Tailscale session — open the Tailscale app and reconnect.