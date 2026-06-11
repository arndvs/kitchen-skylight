import { DateTime } from 'luxon'

/**
 * Sunrise/sunset via the standard Almanac/NOAA approximation (accurate to a
 * couple of minutes — plenty for switching a theme). Pure math, no network.
 */

const ZENITH = 90.833 // official sunrise/sunset includes refraction + solar radius

const rad = (d: number): number => (d * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI
const mod = (n: number, m: number): number => ((n % m) + m) % m

function eventUtcHours(dayOfYear: number, lat: number, lon: number, rising: boolean): number | null {
  const lngHour = lon / 15
  const t = dayOfYear + ((rising ? 6 : 18) - lngHour) / 24
  const M = 0.9856 * t - 3.289
  const L = mod(M + 1.916 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 282.634, 360)
  let RA = mod(deg(Math.atan(0.91764 * Math.tan(rad(L)))), 360)
  // RA must be in the same quadrant as L
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90
  RA /= 15
  const sinDec = 0.39782 * Math.sin(rad(L))
  const cosDec = Math.cos(Math.asin(sinDec))
  const cosH = (Math.cos(rad(ZENITH)) - sinDec * Math.sin(rad(lat))) / (cosDec * Math.cos(rad(lat)))
  if (cosH > 1 || cosH < -1) return null // polar day/night
  const H = (rising ? 360 - deg(Math.acos(cosH)) : deg(Math.acos(cosH))) / 15
  const T = H + RA - 0.06571 * t - 6.622
  return mod(T - lngHour, 24)
}

export interface SunTimes {
  /** local DateTimes on the given local date */
  sunrise: DateTime
  sunset: DateTime
}

/** Sunrise/sunset for a local calendar date (YYYY-MM-DD) in `zone`. Null at polar latitudes. */
export function sunTimes(lat: number, lon: number, dateIso: string, zone: string): SunTimes | null {
  const localDate = DateTime.fromISO(dateIso, { zone })
  if (!localDate.isValid) return null
  const dayOfYear = localDate.ordinal

  const toLocal = (utcHours: number): DateTime => {
    const hour = Math.floor(utcHours)
    const minute = Math.floor((utcHours - hour) * 60)
    // The UT result can land on the previous/next UTC date; pick the candidate
    // whose local date matches the requested one.
    const base = DateTime.utc(localDate.year, localDate.month, localDate.day, hour, minute)
    for (const candidate of [base, base.minus({ days: 1 }), base.plus({ days: 1 })]) {
      if (candidate.setZone(zone).toISODate() === dateIso) return candidate.setZone(zone)
    }
    return base.setZone(zone)
  }

  const rise = eventUtcHours(dayOfYear, lat, lon, true)
  const set = eventUtcHours(dayOfYear, lat, lon, false)
  if (rise === null || set === null) return null
  return { sunrise: toLocal(rise), sunset: toLocal(set) }
}

/** Fallback dark window when no location is configured: 19:00 → 07:00. */
const FALLBACK_DARK_START = 19 * 60
const FALLBACK_DARK_END = 7 * 60

/** Should the display be dark right now under sun-based switching? */
export function isNightAt(now: DateTime, location: { lat: number; lon: number } | null): boolean {
  const minutes = now.hour * 60 + now.minute
  if (!location) {
    return minutes >= FALLBACK_DARK_START || minutes < FALLBACK_DARK_END
  }
  const times = sunTimes(location.lat, location.lon, now.toISODate()!, now.zoneName ?? 'utc')
  if (!times) {
    return minutes >= FALLBACK_DARK_START || minutes < FALLBACK_DARK_END
  }
  return now < times.sunrise || now >= times.sunset
}
