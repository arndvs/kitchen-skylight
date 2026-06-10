import { describe, expect, it } from 'vitest'
import { parseIcsFeed } from '../../src/main/sync/icsMap'

const CHI = 'America/Chicago'

const FEED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:simple@test
DTSTAMP:20260601T000000Z
DTSTART:20260610T140000Z
DTEND:20260610T150000Z
SUMMARY:Simple meeting
LOCATION:Library
END:VEVENT
BEGIN:VEVENT
UID:allday@test
DTSTAMP:20260601T000000Z
DTSTART;VALUE=DATE:20260615
DTEND;VALUE=DATE:20260617
SUMMARY:Two day fair
END:VEVENT
BEGIN:VEVENT
UID:weekly@test
DTSTAMP:20260601T000000Z
DTSTART:20260601T160000Z
DTEND:20260601T170000Z
RRULE:FREQ=WEEKLY;BYDAY=MO
EXDATE:20260615T160000Z
SUMMARY:Weekly sync
END:VEVENT
BEGIN:VEVENT
UID:weekly@test
DTSTAMP:20260601T000000Z
RECURRENCE-ID:20260622T160000Z
DTSTART:20260622T180000Z
DTEND:20260622T190000Z
SUMMARY:Weekly sync (moved)
END:VEVENT
END:VCALENDAR
`

describe('parseIcsFeed', () => {
  const events = parseIcsFeed(FEED, CHI)

  it('parses simple UTC events', () => {
    const e = events.find((x) => x.uid === 'simple@test')!
    expect(e.startAt).toBe('2026-06-10T14:00:00Z')
    expect(e.endAt).toBe('2026-06-10T15:00:00Z')
    expect(e.title).toBe('Simple meeting')
    expect(e.location).toBe('Library')
    expect(e.allDay).toBe(false)
  })

  it('parses all-day events in the device zone', () => {
    const e = events.find((x) => x.uid === 'allday@test')!
    expect(e.allDay).toBe(true)
    expect(e.startAt).toBe('2026-06-15T05:00:00Z') // midnight CDT
    expect(e.endAt).toBe('2026-06-17T05:00:00Z')
  })

  it('parses recurring events with EXDATE', () => {
    const e = events.find((x) => x.uid === 'weekly@test' && !x.recurrenceId)!
    expect(e.rrule).toContain('FREQ=WEEKLY')
    expect(e.exdates).toEqual(['2026-06-15T16:00:00Z'])
  })

  it('parses exception instances with RECURRENCE-ID', () => {
    const e = events.find((x) => x.recurrenceId)!
    expect(e.uid).toBe('weekly@test')
    expect(e.recurrenceId).toBe('2026-06-22T16:00:00Z')
    expect(e.startAt).toBe('2026-06-22T18:00:00Z')
    expect(e.title).toBe('Weekly sync (moved)')
  })
})
