import ICAL from 'ical.js'
import { DateTime, IANAZone } from 'luxon'
import { isoUtc } from '@shared/dates'

/** Pure ICS feed parsing — no Electron or network imports. */

export interface IcsMappedEvent {
  uid: string
  /** original occurrence start (UTC ISO) when this VEVENT overrides one instance */
  recurrenceId: string | null
  title: string
  description: string | null
  location: string | null
  startAt: string
  endAt: string
  tz: string
  allDay: boolean
  rrule: string | null
  exdates: string[]
  rdates: string[]
  status: 'confirmed' | 'cancelled'
}

function icalTimeToIso(t: ICAL.Time, deviceTz: string): { iso: string; tz: string; allDay: boolean } {
  const tzid = t.zone?.tzid ?? null
  if (t.isDate) {
    const dt = DateTime.fromObject({ year: t.year, month: t.month, day: t.day }, { zone: deviceTz }).startOf('day')
    return { iso: isoUtc(dt), tz: deviceTz, allDay: true }
  }
  if (tzid === 'UTC' || tzid === 'Z') {
    const dt = DateTime.fromObject(
      { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second },
      { zone: 'utc' }
    )
    return { iso: isoUtc(dt), tz: 'UTC', allDay: false }
  }
  if (tzid && tzid !== 'floating' && IANAZone.isValidZone(tzid)) {
    const dt = DateTime.fromObject(
      { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second },
      { zone: tzid }
    )
    return { iso: isoUtc(dt), tz: tzid, allDay: false }
  }
  if (tzid && tzid !== 'floating') {
    // custom VTIMEZONE (e.g. Outlook names) — let ical.js compute the instant
    const dt = DateTime.fromJSDate(t.toJSDate())
    return { iso: isoUtc(dt), tz: deviceTz, allDay: false }
  }
  // floating time — interpret in the device zone
  const dt = DateTime.fromObject(
    { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second },
    { zone: deviceTz }
  )
  return { iso: isoUtc(dt), tz: deviceTz, allDay: false }
}

export function parseIcsFeed(text: string, deviceTz: string): IcsMappedEvent[] {
  const comp = new ICAL.Component(ICAL.parse(text))

  for (const vtz of comp.getAllSubcomponents('vtimezone')) {
    try {
      const tz = new ICAL.Timezone(vtz)
      if (tz.tzid && !ICAL.TimezoneService.has(tz.tzid)) ICAL.TimezoneService.register(tz)
    } catch {
      // ignore malformed timezone definitions
    }
  }

  const out: IcsMappedEvent[] = []
  for (const vevent of comp.getAllSubcomponents('vevent')) {
    try {
      const ev = new ICAL.Event(vevent)
      if (!ev.uid || !ev.startDate) continue
      const start = icalTimeToIso(ev.startDate, deviceTz)
      const end = ev.endDate ? icalTimeToIso(ev.endDate, deviceTz) : start
      let endIso = end.iso
      if (start.allDay && endIso <= start.iso) {
        endIso = isoUtc(DateTime.fromISO(start.iso, { zone: 'utc' }).setZone(start.tz).plus({ days: 1 }))
      }

      const rruleValue = vevent.getFirstPropertyValue('rrule')
      const exdates: string[] = []
      for (const prop of vevent.getAllProperties('exdate')) {
        for (const v of prop.getValues() as ICAL.Time[]) {
          try {
            exdates.push(icalTimeToIso(v, deviceTz).iso)
          } catch {
            /* skip */
          }
        }
      }
      const rdates: string[] = []
      for (const prop of vevent.getAllProperties('rdate')) {
        for (const v of prop.getValues() as ICAL.Time[]) {
          try {
            rdates.push(icalTimeToIso(v, deviceTz).iso)
          } catch {
            /* skip */
          }
        }
      }

      const recurrenceIdRaw = vevent.getFirstPropertyValue('recurrence-id') as ICAL.Time | null
      const statusRaw = String(vevent.getFirstPropertyValue('status') ?? '').toUpperCase()

      out.push({
        uid: ev.uid,
        recurrenceId: recurrenceIdRaw ? icalTimeToIso(recurrenceIdRaw, deviceTz).iso : null,
        title: ev.summary || '(no title)',
        description: ev.description || null,
        location: ev.location || null,
        startAt: start.iso,
        endAt: endIso,
        tz: start.tz,
        allDay: start.allDay,
        rrule: rruleValue ? String(rruleValue) : null,
        exdates,
        rdates,
        status: statusRaw === 'CANCELLED' ? 'cancelled' : 'confirmed'
      })
    } catch {
      // one bad VEVENT must not kill the whole feed
    }
  }
  return out
}
