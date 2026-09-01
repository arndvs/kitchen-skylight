import { DateTime } from 'luxon'

/** Fixed light window: 07:00 → 18:00. Outside it, the display is dark. */
const LIGHT_START = 7 * 60
const LIGHT_END = 18 * 60

/** Should the display be dark right now? True outside the 7am–6pm light window. */
export function isNightAt(now: DateTime): boolean {
  const minutes = now.hour * 60 + now.minute
  return minutes < LIGHT_START || minutes >= LIGHT_END
}
