import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { isNightAt } from '../../src/shared/sun'

const CHI = 'America/Chicago'
const at = (iso: string): DateTime => DateTime.fromISO(iso, { zone: CHI })

describe('isNightAt', () => {
  it('is light from 7am to 6pm and dark otherwise', () => {
    expect(isNightAt(at('2026-06-10T06:59'))).toBe(true)
    expect(isNightAt(at('2026-06-10T07:00'))).toBe(false)
    expect(isNightAt(at('2026-06-10T12:00'))).toBe(false)
    expect(isNightAt(at('2026-06-10T17:59'))).toBe(false)
    expect(isNightAt(at('2026-06-10T18:00'))).toBe(true)
    expect(isNightAt(at('2026-06-10T21:00'))).toBe(true)
    expect(isNightAt(at('2026-06-10T04:00'))).toBe(true)
  })

  it('is timezone-independent (uses the instant as given)', () => {
    const utc = DateTime.fromISO('2026-06-10T12:00:00Z', { zone: 'utc' })
    expect(isNightAt(utc)).toBe(false)
    expect(isNightAt(utc.plus({ hours: 7 }))).toBe(true)
  })
})
