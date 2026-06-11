import { useEffect, useState } from 'react'
import { DateTime } from 'luxon'
import { isNightAt } from '@shared/sun'
import { useSettings } from '../api/hooks'
import { ZONE } from '../stores/uiStore'

/**
 * Applies the theme to <html>. 'auto' follows the sun at the configured
 * weather location (computed locally — no network), re-evaluated every minute
 * so the switch happens right at sunset/sunrise.
 */
export function useTheme(): void {
  const { data: settings } = useSettings()
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const theme = settings?.theme ?? 'auto'
  const weather = settings?.weather ?? null
  const dark =
    theme === 'dark' ||
    (theme === 'auto' && isNightAt(DateTime.now().setZone(ZONE), weather ? { lat: weather.lat, lon: weather.lon } : null))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
}
