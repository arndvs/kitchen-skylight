# Machine Backup Plan

This document outlines the backup strategy for the kitchen skylight machine
(Dell OptiPlex 7060, i5-8500T, 8GB RAM, 512GB SSD, Windows 11 Pro).

## Why backup?

This machine is an **always-on family appliance** — it holds the family
calendar, recipes, chores, and (eventually) home automation config. If the SSD
fails or Windows corrupts, we want to restore to a known-good state quickly.

## Backup Strategy: Full Disk Image

A full disk image clones the entire SSD so we can restore the machine
byte-for-byte (bare-metal restore) — including Windows, all apps, and all data.

### Requirements

- **Destination:** An external USB drive (or network location) **other than the
  C: drive being imaged**. A **128–256GB** drive is plenty for a compressed
  image of the ~50GB used space.
- **Tool:** Macrium Reflect Free, Clonezilla, or Windows built-in backup.

### Steps

1. **Connect an external USB drive** (≥128GB recommended).
2. **Create the image:**
   - **Macrium Reflect Free** (easiest on Windows):
     - Open Macrium → "Backup" → select the C: drive → choose the external
       drive as destination → start backup.
     - Produces a compressed `.mrimg` file.
   - **Clonezilla** (bootable USB): boot from Clonezilla, clone disk-to-image.
3. **Verify the image** by restoring it to a spare drive or checking the image
   integrity (Macrium can verify).
4. **Store the image** on the external drive, ideally in a safe place.

### Restore

- Boot from the Macrium recovery USB (or Clonezilla USB).
- Select the image and restore it to the internal SSD.
- The machine returns to the exact state at backup time.

## Alternative: File-Level Backup

If a full disk image isn't feasible, at minimum back up the app data:

- **Kitchen Skylight data:** `%APPDATA%/kitchen-skylight/kitchen-skylight.db` (SQLite)
- **Photos:** the configured photo folder
- **Config:** any `.env` or settings files

## Schedule

- **Initial:** Full disk image now (before heavy customization).
- **Ongoing:** Weekly file-level backup of app data; monthly full image.

## Notes

- The machine has **~426GB free** of 512GB — plenty of room.
- Keep the backup drive **disconnected** when not backing up (protects against
  ransomware and power surges).