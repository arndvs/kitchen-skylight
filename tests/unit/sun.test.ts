import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { isNightAt, sunTimes } from '../../src/shared/sun'

const CHI = 'America/Chicago'
const closeTo = (dt: DateTime, hhmm: string, toleranceMin = 10): void => {
  const [h, m] = hhmm.split(':').map(Number)
  const actual = dt.hour * 60 + dt.minute
  expect(Math.abs(actual - (h * 60 + m))).toBeLessThanOrEqual(toleranceMin)
}

describe('sunTimes', () => {
  it('matches known values for Chicago in June', () => {
    // ~5:15 sunrise / ~20:28 sunset CDT around June 10
    const t = sunTimes(41.85, -87.65, '2026-06-10', CHI)!
    expect(t.sunrise.toISODate()).toBe('2026-06-10')
    expect(t.sunset.toISODate()).toBe('2026-06-10')
    closeTo(t.sunrise, '05:15')
    closeTo(t.sunset, '20:28')
  })

  it('matches known values for London in December', () => {
    // ~8:04 sunrise / ~15:53 sunset GMT on the winter solstice
    const t = sunTimes(51.5, -0.12, '2026-12-21', 'Europe/London')!
    closeTo(t.sunrise, '08:04')
    closeTo(t.sunset, '15:53')
  })

  it('matches known values for Sydney (southern hemisphere, UTC+10/11)', () => {
    // ~5:40 sunrise / ~20:05 sunset AEDT around Dec 21
    const t = sunTimes(-33.87, 151.21, '2026-12-21', 'Australia/Sydney')!
    expect(t.sunrise.toISODate()).toBe('2026-12-21')
    closeTo(t.sunrise, '05:40', 15)
    closeTo(t.sunset, '20:05', 15)
  })

  it('returns null for polar night', () => {
    expect(sunTimes(78.2, 15.6, '2026-12-21', 'Arctic/Longyearbyen')).toBeNull()
  })
})

describe('isNightAt', () => {
  const loc = { lat: 41.85, lon: -87.65 }
  const at = (iso: string): DateTime => DateTime.fromISO(iso, { zone: CHI })

  it('is light during the day and dark after sunset', () => {
    expect(isNightAt(at('2026-06-10T12:00'), loc)).toBe(false)
    expect(isNightAt(at('2026-06-10T21:00'), loc)).toBe(true)
    expect(isNightAt(at('2026-06-10T04:00'), loc)).toBe(true)
    expect(isNightAt(at('2026-06-10T06:00'), loc)).toBe(false)
  })

  it('falls back to 19:00–07:00 without a location', () => {
    expect(isNightAt(at('2026-06-10T18:59'), null)).toBe(false)
    expect(isNightAt(at('2026-06-10T19:00'), null)).toBe(true)
    expect(isNightAt(at('2026-06-10T06:59'), null)).toBe(true)
    expect(isNightAt(at('2026-06-10T07:00'), null)).toBe(false)
  })

  it('falls back at polar latitudes', () => {
    const polar = { lat: 78.2, lon: 15.6 }
    const arctic = DateTime.fromISO('2026-12-21T12:00', { zone: 'Arctic/Longyearbyen' })
    expect(isNightAt(arctic, polar)).toBe(false) // midday falls in the 19–07 fallback's light window
  })
})
