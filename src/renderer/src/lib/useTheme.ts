import { useEffect, useRef } from 'react'
import { DateTime } from 'luxon'
import { isNightAt } from '@shared/sun'
import type { AppSettings } from '@shared/types'
import { useSettings } from '../api/hooks'
import { ZONE } from '../stores/uiStore'

function applyTheme(settings: AppSettings | undefined): void {
  // do nothing until settings load — applying the 'auto' fallback early would
  // flash the wrong theme for users with an explicit light/dark choice
  if (!settings) return
  const weather = settings.weather ? { lat: settings.weather.lat, lon: settings.weather.lon } : null
  const dark =
    settings.theme === 'dark' ||
    (settings.theme === 'auto' && isNightAt(DateTime.now().setZone(ZONE), weather))
  document.documentElement.classList.toggle('dark', dark)
}

/**
 * Applies the theme to <html>. 'auto' follows the sun at the configured
 * weather location (computed locally — no network). The minute re-check runs
 * outside React state so the app tree is NOT re-rendered every tick.
 */
export function useTheme(): void {
  const { data: settings } = useSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    applyTheme(settings)
    // only 'auto' can change with the clock; light/dark need no timer at all
    if (settings?.theme !== 'auto') return
    const timer = setInterval(() => applyTheme(settingsRef.current), 60_000)
    return () => clearInterval(timer)
  }, [settings])
}
