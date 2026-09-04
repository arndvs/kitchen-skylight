#!/usr/bin/env pwsh
# setup-kiosk.ps1 - Turn this Windows machine into a true always-on kiosk for
# the Kitchen Skylight app: a dedicated passwordless 'kiosk' user auto-logs in
# at boot and the app launches fullscreen.
#
# Why not Assigned Access: Set-AssignedAccess is finicky about Win32 desktop
# app path/AUMID and keeps failing with "Application was not found". The app
# already runs fullscreen-kiosk by itself, so auto-login + launch-on-login is
# simpler and more reliable for an Electron appliance.
#
# What it does:
#   1. Creates a dedicated local 'kiosk' user account (no password).
#   2. Sets Winlogon auto-login so the kiosk account signs in at boot.
#   3. Adds the app to the kiosk user's Startup so it launches fullscreen.
#
# MUST be run as Administrator.
# Idempotent. Reversible: remove the Startup .cmd, reset Winlogon, Remove-LocalUser.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-kiosk.ps1
#
# After it completes, reboot: the machine boots straight into the kiosk app.

$ErrorActionPreference = 'Stop'
$AppPath = 'C:\Program Files\Kitchen Skylight\Kitchen Skylight.exe'
$KioskUser = 'kiosk'

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'Must run as Administrator. Right-click PowerShell - Run as Administrator.'
  }
}
Assert-Admin

if (-not (Test-Path $AppPath)) {
  throw "Kitchen Skylight not installed at $AppPath. Run its installer first."
}

# --- 1. Create the kiosk user (if missing) ---
if (-not (Get-LocalUser -Name $KioskUser -ErrorAction SilentlyContinue)) {
  Write-Host "Creating local user '$KioskUser'..."
  # Passwordless: empty-but-valid SecureString (New-LocalUser requires -Password).
  $emptyPw = New-Object System.Security.SecureString
  New-LocalUser -Name $KioskUser -Password $emptyPw -Description 'Kitchen Skylight kiosk account' -AccountNeverExpires
  Write-Host "User '$KioskUser' created."
} else {
  Write-Host "User '$KioskUser' already exists - keeping it."
}

# --- 2. Auto-login the kiosk user at boot ---
$wl = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
Set-ItemProperty -Path $wl -Name AutoAdminLogon -Value 1
Set-ItemProperty -Path $wl -Name DefaultUserName -Value $KioskUser
Set-ItemProperty -Path $wl -Name DefaultDomainName -Value $env:COMPUTERNAME
Remove-ItemProperty -Path $wl -Name DefaultPassword -ErrorAction SilentlyContinue
Write-Host "Auto-login set for '$KioskUser'."

# --- 3. Launch the app at the kiosk user's login (Startup folder) ---
$kioskProfile = "C:\Users\$KioskUser"
if (Test-Path $kioskProfile) {
  $startup = Join-Path $kioskProfile 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup'
  New-Item -ItemType Directory -Force -Path $startup | Out-Null
  $launcher = Join-Path $startup 'KitchenSkylight.cmd'
  @("@echo off", "cd /d `"$kioskProfile`"", "start `"`" `"$AppPath`"") -join "`r`n" | Set-Content -Path $launcher -Encoding Ascii
  Write-Host "Added app to '$KioskUser' Startup: $launcher"
} else {
  Write-Warning "Profile for '$KioskUser' not found yet - app will launch once the user has signed in once. Re-run the script after the first kiosk login."
}

Write-Host ''
Write-Host 'Kiosk setup complete.'
Write-Host '  - User       : kiosk (local, no password)'
Write-Host "  - App        : $AppPath"
Write-Host '  - Boot       : kiosk user auto-logs in and starts the app fullscreen.'
Write-Host ''
Write-Host 'Reboot now (Start > Power > Restart). After boot it should go straight to the app.'
Write-Host 'To undo: reset Winlogon auto-login, delete the Startup .cmd, then Remove-LocalUser -Name kiosk'