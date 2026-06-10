import { DateTime } from 'luxon'
import type { RecurrenceInput, RecurrenceFreq } from '../types'

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
const FREQS: RecurrenceFreq[] = ['daily', 'weekly', 'monthly', 'yearly']

function formatUntilUtc(dt: DateTime): string {
  return dt.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")
}

/**
 * Build an RRULE value (without the "RRULE:" prefix) from the simplified UI model.
 * `untilDate` is a local calendar date in `tz`; the rule runs through the end of that day.
 */
export function buildRRuleString(r: RecurrenceInput, tz: string): string {
  const parts = [`FREQ=${r.freq.toUpperCase()}`]
  if (r.interval && r.interval > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.freq === 'weekly' && r.byWeekdays && r.byWeekdays.length > 0) {
    parts.push(`BYDAY=${[...r.byWeekdays].sort((a, b) => a - b).map((d) => DAY_CODES[d]).join(',')}`)
  }
  if (r.untilDate) {
    const until = DateTime.fromISO(r.untilDate, { zone: tz }).endOf('day')
    parts.push(`UNTIL=${formatUntilUtc(until)}`)
  } else if (r.count && r.count > 0) {
    parts.push(`COUNT=${r.count}`)
  }
  return parts.join(';')
}

/** Parse an RRULE value back to the simplified model. Returns null if it uses features we don't model. */
export function parseRRuleString(rrule: string, tz: string): RecurrenceInput | null {
  const map = new Map<string, string>()
  for (const part of rrule.replace(/^RRULE:/i, '').split(';')) {
    if (!part) continue
    const [k, v] = part.split('=')
    map.set(k.toUpperCase(), v ?? '')
  }
  const freq = (map.get('FREQ') ?? '').toLowerCase() as RecurrenceFreq
  if (!FREQS.includes(freq)) return null

  const out: RecurrenceInput = { freq }
  const interval = Number(map.get('INTERVAL') ?? '1')
  if (interval > 1) out.interval = interval

  const byday = map.get('BYDAY')
  if (byday) {
    const days = byday
      .split(',')
      .map((code) => DAY_CODES.indexOf(code.trim().toUpperCase() as (typeof DAY_CODES)[number]))
    if (days.some((d) => d < 0)) return null // positional BYDAY like 2MO — not modeled
    out.byWeekdays = days
  }

  const until = map.get('UNTIL')
  if (until) {
    const dt = until.includes('T')
      ? DateTime.fromFormat(until, "yyyyMMdd'T'HHmmss'Z'", { zone: 'utc' })
      : DateTime.fromFormat(until, 'yyyyMMdd', { zone: tz }).endOf('day')
    if (!dt.isValid) return null
    out.untilDate = dt.setZone(tz).toISODate()!
  }
  const count = map.get('COUNT')
  if (count) out.count = Number(count)
  return out
}

/**
 * Rewrite a rule to stop just before `untilUtcIso` (used by "edit/delete this and following").
 * Drops COUNT (a split series can't keep an absolute count).
 */
export function withUntilInstant(rrule: string, untilUtcIso: string): string {
  const until = DateTime.fromISO(untilUtcIso, { zone: 'utc' }).minus({ seconds: 1 })
  const parts = rrule
    .replace(/^RRULE:/i, '')
    .split(';')
    .filter((p) => p && !/^(UNTIL|COUNT)=/i.test(p))
  parts.push(`UNTIL=${formatUntilUtc(until)}`)
  return parts.join(';')
}

/** Drop COUNT and UNTIL — used for the new series created by a "following" split. */
export function withoutEndCap(rrule: string): string {
  return rrule
    .replace(/^RRULE:/i, '')
    .split(';')
    .filter((p) => p && !/^COUNT=/i.test(p))
    .join(';')
}

export function describeRecurrence(r: RecurrenceInput | null): string {
  if (!r) return 'Does not repeat'
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const every = r.interval && r.interval > 1 ? `Every ${r.interval} ` : ''
  let base: string
  switch (r.freq) {
    case 'daily':
      base = every ? `${every}days` : 'Daily'
      break
    case 'weekly': {
      const days = r.byWeekdays?.length ? ` on ${r.byWeekdays.map((d) => names[d]).join(', ')}` : ''
      base = (every ? `${every}weeks` : 'Weekly') + days
      break
    }
    case 'monthly':
      base = every ? `${every}months` : 'Monthly'
      break
    case 'yearly':
      base = every ? `${every}years` : 'Yearly'
      break
  }
  if (r.untilDate) base += ` until ${DateTime.fromISO(r.untilDate).toFormat('MMM d, yyyy')}`
  else if (r.count) base += `, ${r.count} times`
  return base
}
