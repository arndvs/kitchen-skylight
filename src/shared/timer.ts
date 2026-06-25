/**
 * Pure timer helpers shared by the tile, the quick-add UI, and the voice layer.
 * No DOM, no Electron — just text → duration parsing and formatting, so the
 * messy natural-language bits are fully unit-testable.
 */

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19
}
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
}
const UNIT_SECONDS: Record<string, number> = {
  h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
  m: 60, min: 60, mins: 60, minute: 60, minutes: 60,
  s: 1, sec: 1, secs: 1, second: 1, seconds: 1
}
/** Words that connect a number to its "and a half" without resetting it. */
const CONNECTORS = new Set(['and', 'a', 'an'])

const MAX_SECONDS = 24 * 3600 // a day; rejects nonsense like "1000000 minutes"

export interface ParsedTimer {
  seconds: number
  label?: string
}

/** Collapse a run of number words starting at `i` into a value; returns null if none. */
function readNumber(tokens: string[], i: number): { value: number; next: number } | null {
  // a literal digit string
  if (/^\d+$/.test(tokens[i])) return { value: Number(tokens[i]), next: i + 1 }
  let total = 0
  let used = false
  let j = i
  while (j < tokens.length) {
    const t = tokens[j]
    if (t in TENS) {
      total += TENS[t]
      used = true
      j++
      // optional ones after a tens word: "twenty five"
      if (j < tokens.length && tokens[j] in ONES && ONES[tokens[j]] < 10) {
        total += ONES[tokens[j]]
        j++
      }
    } else if (t in ONES) {
      total += ONES[t]
      used = true
      j++
    } else if (t === 'hundred' && used) {
      total *= 100
      j++
    } else {
      break
    }
  }
  return used ? { value: total, next: j } : null
}

/**
 * Parse a spoken or typed timer phrase into a duration (+ optional label).
 * Handles digits and number words, h/m/s in many spellings, and "half"
 * ("half an hour", "a minute and a half", "two and a half minutes").
 * Returns null when no positive duration is found.
 */
export function parseTimerCommand(raw: string): ParsedTimer | null {
  const text = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  const tokens = text.split(/\s+/).filter(Boolean)

  let total = 0
  let pending: number | null = null
  let half = false
  let lastUnitSec = 0
  const usedTokens = new Set<number>()

  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i]
    const num = readNumber(tokens, i)
    if (num) {
      pending = num.value
      for (let k = i; k < num.next; k++) usedTokens.add(k)
      i = num.next
      continue
    }
    if (t === 'half') {
      half = true
      usedTokens.add(i)
      i++
      continue
    }
    if (t in UNIT_SECONDS) {
      const unit = UNIT_SECONDS[t]
      const qty = pending !== null ? (half ? pending + 0.5 : pending) : half ? 0.5 : 1
      total += qty * unit
      lastUnitSec = unit
      pending = null
      half = false
      usedTokens.add(i)
      i++
      continue
    }
    if (CONNECTORS.has(t)) {
      i++ // keep pending/half alive across "and a half"
      continue
    }
    // any other word breaks a number from a far-away unit
    pending = null
    half = false
    i++
  }
  // trailing "… and a half" applies to the last unit seen ("an hour and a half")
  if (half && lastUnitSec) total += 0.5 * lastUnitSec

  const seconds = Math.round(total)
  if (seconds <= 0 || seconds > MAX_SECONDS) return null

  const label = extractLabel(tokens, usedTokens)
  return label ? { seconds, label } : { seconds }
}

const STOPWORDS = new Set([
  'set', 'start', 'create', 'make', 'put', 'add', 'new', 'please', 'timer', 'timers',
  'countdown', 'for', 'the', 'my', 'me', 'called', 'named', 'on', 'of', 'to', 'up'
])

/** Best-effort label from the words left over after the duration + filler. */
function extractLabel(tokens: string[], usedTokens: Set<number>): string | undefined {
  const words = tokens.filter((t, i) => !usedTokens.has(i) && !STOPWORDS.has(t) && !CONNECTORS.has(t))
  if (words.length === 0 || words.length > 4) return undefined
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

/** Seconds → "M:SS" (under an hour) or "H:MM:SS". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** Spoken summary for confirmation, e.g. "1 hour 5 minutes". */
export function describeDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`)
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`)
  if (s) parts.push(`${s} second${s === 1 ? '' : 's'}`)
  return parts.join(' ') || '0 seconds'
}
