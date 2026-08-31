#!/usr/bin/env pwsh
# setup-kiosk.ps1 — Turn this Windows machine into a true always-on kiosk for
# the Kitchen Skylight app using Windows Assigned Access (kiosk mode).
#
# What it does:
#   1. Creates a dedicated local 'kiosk' user account (no password → no PIN /
#      Microsoft-account friction).
#   2. Assigned-Access to auto-login that user and launch the app fullscreen.
#   3. Registers the app to be the only thing that user can run.
#
# MUST be run as Administrator (right-click PowerShell → Run as Administrator).
# Idempotent: safe to re-run. Reversible with Remove-AssignedAccess / Remove-LocalUser.
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
    Write-Error 'Must run as Administrator. Right-click PowerShell → Run as Administrator.'
  }
}
Assert-Admin

if (-not (Test-Path $AppPath)) {
  throw "Kitchen Skylight not installed at $AppPath. Run its installer first."
}

# --- 1. Create the kiosk user (if missing) ---
if (-not (Get-LocalUser -Name $KioskUser -ErrorAction SilentlyContinue)) {
  Write-Host "Creating local user '$KioskUser'…"
  $pw = ConvertTo-SecureString -String '' -AsPlainText -Force   # empty password, not a personal MS account
  New-LocalUser -Name $KioskUser -Password $pw -Description 'Kitchen Skylight kiosk account' -AccountNeverExpires
  # The kiosk user must never see the lock screen prompt at sign-in.
  Write-Host "User '$KioskUser' created."
} else {
  Write-Host "User '$KioskUser' already exists — keeping it."
}

# --- 2. Enable Assigned Access so only the app runs, fullscreen ---
Write-Host "Assigning '$KioskUser' to launch Kitchen Skylight fullscreen…"
Set-AssignedAccess -UserName $KioskUser -AppName $AppPath

# --- 3. Make the kiosk user auto-login at boot (no password dance) ---
# With Assigned Access, the assigned account auto-signs in and is locked to the
# app. We also set Winlogon auto-login so the very first boot lands in the app.
$wl = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
Set-ItemProperty -Path $wl -Name AutoAdminLogon -Value 1
Set-ItemProperty -Path $wl -Name DefaultUserName -Value $KioskUser
Set-ItemProperty -Path $wl -Name DefaultDomainName -Value $env:COMPUTERNAME
# Assigned Access kiosk accounts use an empty local password; clear any stale one.
Remove-ItemProperty -Path $wl -Name DefaultPassword -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Kiosk setup complete.'
Write-Host '  - User       : kiosk (local, no password)'
Write-Host "  - App        : $AppPath"
Write-Host '  - Auto-login : the kiosk account signs in and runs the app fullscreen.'
Write-Host ''
Write-Host 'Reboot now (Start → Power → Restart). After boot it should go straight to the app.'
Write-Host 'To undo: run:  Remove-AssignedAccess -UserName kiosk;  Remove-LocalUser -Name kiosk'

# Check results
Write-Host ''
Write-Host 'Verification:'
$assigned = Get-AssignedAccess -ErrorAction SilentlyContinue
if ($assigned) { $assigned | Format-List } else { Write-Host '  (No active Assigned Access yet — it applies after reboot.)' }