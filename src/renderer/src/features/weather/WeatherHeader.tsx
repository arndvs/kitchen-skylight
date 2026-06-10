import { useState, type ComponentType, type SVGProps } from 'react'
import { DateTime } from 'luxon'
import { useWeather } from '../../api/hooks'
import { Dialog } from '../../components/ui'
import {
  CloudIcon,
  CloudSunIcon,
  FogIcon,
  MoonIcon,
  RainIcon,
  SnowIcon,
  StormIcon,
  SunIcon
} from '../../components/icons'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

/** WMO weather code → icon */
export function weatherIcon(code: number, isDay: boolean): Icon {
  if (code === 0) return isDay ? SunIcon : MoonIcon
  if (code <= 2) return isDay ? CloudSunIcon : MoonIcon
  if (code === 3) return CloudIcon
  if (code === 45 || code === 48) return FogIcon
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return RainIcon
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return SnowIcon
  if (code >= 95) return StormIcon
  return CloudIcon
}

export function WeatherButton() {
  const { data: weather } = useWeather()
  const [open, setOpen] = useState(false)
  if (!weather) return null
  const Icon = weatherIcon(weather.code, weather.isDay)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-paper-deep/70"
        aria-label="Weather forecast"
      >
        <Icon size={34} className="text-ember-deep" />
        <span className="font-display text-3xl leading-none">{weather.temperature}°</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={weather.label}>
        <div className="grid grid-cols-5 gap-2">
          {weather.daily.map((d, i) => {
            const DayIcon = weatherIcon(d.code, true)
            return (
              <div key={d.date} className="flex flex-col items-center gap-1.5 rounded-2xl bg-paper-deep/50 px-1 py-3">
                <span className="text-sm font-extrabold text-ink-faint uppercase">
                  {i === 0 ? 'Today' : DateTime.fromISO(d.date).toFormat('ccc')}
                </span>
                <DayIcon size={30} className="text-ember-deep" />
                <span className="text-lg font-bold">{d.high}°</span>
                <span className="text-base font-bold text-ink-faint">{d.low}°</span>
                {d.precipProb !== null && d.precipProb > 20 && (
                  <span className="text-xs font-extrabold text-[#0091FF]">{d.precipProb}%</span>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-center text-sm font-semibold text-ink-faint">
          Updated {DateTime.fromISO(weather.fetchedAt).toRelative()} · change location in Settings
        </p>
      </Dialog>
    </>
  )
}
