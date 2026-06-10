/** Pure sleep-window math (supports overnight ranges like 21:30 → 06:30). */

export function parseHhMm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Is `nowMinutes` (minutes since local midnight) inside [start, end)? */
export function isInSleepWindow(nowMinutes: number, start: string, end: string): boolean {
  const s = parseHhMm(start)
  const e = parseHhMm(end)
  if (s === null || e === null || s === e) return false
  if (s < e) return nowMinutes >= s && nowMinutes < e
  // overnight window
  return nowMinutes >= s || nowMinutes < e
}
