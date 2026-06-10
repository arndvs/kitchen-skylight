import { describe, expect, it } from 'vitest'
import {
  gItemToMapped,
  gTimeToInstant,
  instanceProviderId,
  parseGoogleRecurrence,
  rowToGResource
} from '../../src/main/sync/googleMap'

const CHI = 'America/Chicago'

describe('gTimeToInstant', () => {
  it('parses dateTime with explicit timezone', () => {
    const r = gTimeToInstant({ dateTime: '2026-06-10T09:00:00-05:00', timeZone: CHI }, 'UTC')
    expect(r).toEqual({ iso: '2026-06-10T14:00:00Z', allDay: false, tz: CHI })
  })

  it('parses all-day dates in the fallback zone', () => {
    const r = gTimeToInstant({ date: '2026-06-10' }, CHI)
    expect(r.allDay).toBe(true)
    expect(r.iso).toBe('2026-06-10T05:00:00Z') // midnight CDT
  })
})

describe('parseGoogleRecurrence', () => {
  it('extracts RRULE and EXDATEs with TZID', () => {
    const r = parseGoogleRecurrence(
      ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE', 'EXDATE;TZID=America/Chicago:20260615T090000,20260617T090000'],
      CHI
    )
    expect(r.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE')
    expect(r.exdates).toEqual(['2026-06-15T14:00:00Z', '2026-06-17T14:00:00Z'])
  })

  it('parses UTC and date-only EXDATE values', () => {
    const r = parseGoogleRecurrence(['RRULE:FREQ=DAILY', 'EXDATE:20260615T140000Z', 'EXDATE;VALUE=DATE:20260620'], CHI)
    expect(r.exdates).toContain('2026-06-15T14:00:00Z')
    expect(r.exdates).toContain('2026-06-20T05:00:00Z')
  })
})

describe('instanceProviderId', () => {
  it('formats timed instances with a UTC basic stamp', () => {
    expect(instanceProviderId('abc123', '2026-06-15T14:00:00Z', false)).toBe('abc123_20260615T140000Z')
  })
  it('formats all-day instances with a date stamp', () => {
    expect(instanceProviderId('abc123', '2026-06-15T05:00:00Z', true)).toBe('abc123_20260615')
  })
})

describe('gItemToMapped', () => {
  it('maps a timed recurring master with people', () => {
    const m = gItemToMapped(
      {
        id: 'g1',
        etag: '"e1"',
        status: 'confirmed',
        summary: 'Soccer',
        start: { dateTime: '2026-06-01T09:00:00-05:00', timeZone: CHI },
        end: { dateTime: '2026-06-01T10:00:00-05:00', timeZone: CHI },
        recurrence: ['RRULE:FREQ=WEEKLY'],
        updated: '2026-06-01T00:00:00.000Z',
        extendedProperties: { private: { osl_people: 'p1,p2' } }
      },
      'UTC'
    )!
    expect(m.startAt).toBe('2026-06-01T14:00:00Z')
    expect(m.rrule).toBe('FREQ=WEEKLY')
    expect(m.personIds).toEqual(['p1', 'p2'])
    expect(m.tz).toBe(CHI)
  })

  it('maps a cancelled exception instance', () => {
    const m = gItemToMapped(
      {
        id: 'g1_20260615T140000Z',
        status: 'cancelled',
        recurringEventId: 'g1',
        originalStartTime: { dateTime: '2026-06-15T09:00:00-05:00', timeZone: CHI }
      },
      'UTC'
    )!
    expect(m.status).toBe('cancelled')
    expect(m.recurringProviderId).toBe('g1')
    expect(m.originalStartAt).toBe('2026-06-15T14:00:00Z')
  })
})

describe('rowToGResource', () => {
  it('round-trips a timed recurring row', () => {
    const res = rowToGResource({
      title: 'Soccer',
      description: null,
      location: 'Park',
      startAt: '2026-06-01T14:00:00Z',
      endAt: '2026-06-01T15:00:00Z',
      tz: CHI,
      allDay: false,
      rrule: 'FREQ=WEEKLY',
      exdates: JSON.stringify(['2026-06-15T14:00:00Z']),
      rdates: null,
      personIds: ['p1']
    }) as Record<string, any>
    expect(res.start).toEqual({ dateTime: '2026-06-01T09:00:00-05:00', timeZone: CHI })
    expect(res.recurrence).toEqual(['RRULE:FREQ=WEEKLY', 'EXDATE;TZID=America/Chicago:20260615T090000'])
    expect(res.extendedProperties).toEqual({ private: { osl_people: 'p1' } })
  })

  it('uses date fields for all-day rows', () => {
    const res = rowToGResource({
      title: 'Trip',
      description: null,
      location: null,
      startAt: '2026-06-10T05:00:00Z',
      endAt: '2026-06-12T05:00:00Z',
      tz: CHI,
      allDay: true,
      rrule: null,
      exdates: null,
      rdates: null,
      personIds: []
    }) as Record<string, any>
    expect(res.start).toEqual({ date: '2026-06-10' })
    expect(res.end).toEqual({ date: '2026-06-12' })
  })
})
