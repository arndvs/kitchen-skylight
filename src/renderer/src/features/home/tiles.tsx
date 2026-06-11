import { useEffect, useState } from 'react'
import { DateTime } from 'luxon'
import { useQuery } from '@tanstack/react-query'
import type { HomeTile } from '@shared/types'
import { presetById } from '@shared/rss'
import { agendaRange, dayRange, eachDay } from '@shared/dates'
import { ipcInvoke } from '../../api/client'
import {
  useBalances,
  useChoresDay,
  useLists,
  useMeals,
  usePeople,
  useSettings,
  useWeather
} from '../../api/hooks'
import { useCalendarData } from '../calendar/useCalendarData'
import { weatherIcon } from '../weather/WeatherHeader'
import { SLOT_META } from '../meals/Meals'
import { ZONE } from '../../stores/uiStore'
import { formatTime, initials, textOn } from '../../lib/format'
import { occurrenceColor } from '../../lib/colors'
import { CheckIcon } from '../../components/icons'

export interface TileProps {
  tile: HomeTile
  /** true when the rendered tile is physically small — show denser content */
  compact: boolean
}

function TileTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 shrink-0 text-xs font-extrabold tracking-wide text-ink-faint uppercase">{children}</div>
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-2 text-center text-sm font-bold text-ink-faint">
      {children}
    </div>
  )
}

const today = (): string => DateTime.now().setZone(ZONE).toISODate()!

export function TodayEventsTile({ compact }: TileProps) {
  const range = dayRange(today(), ZONE)
  const { byDay, peopleById, calendarsById } = useCalendarData(range)
  const { data: settings } = useSettings()
  const occurrences = byDay.get(today()) ?? []
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TileTitle>Today</TileTitle>
      {occurrences.length === 0 ? (
        <Placeholder>Nothing on the calendar today</Placeholder>
      ) : (
        <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden">
          {occurrences.map((occ) => {
            const color = occurrenceColor(occ, peopleById, calendarsById)
            return (
              <div key={occ.key} className="flex items-center gap-2 rounded-lg bg-paper-deep/40 px-2 py-1.5">
                <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-bold ${compact ? 'text-sm' : 'text-base'}`}>{occ.title}</span>
                  <span className="block text-xs font-bold text-ink-faint">
                    {occ.allDay ? 'All day' : formatTime(occ.start, settings?.timeFormat ?? '12h')}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function WeekAgendaTile({ compact }: TileProps) {
  const range = agendaRange(today(), ZONE, 7)
  const { byDay, peopleById, calendarsById } = useCalendarData(range)
  const { data: settings } = useSettings()
  const days = eachDay(range, ZONE)
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TileTitle>This week</TileTitle>
      <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
        {days.map((day) => {
          const key = day.toISODate()!
          const occs = byDay.get(key) ?? []
          if (occs.length === 0) return null
          return (
            <div key={key} className="flex items-start gap-2">
              <span className="w-12 shrink-0 pt-0.5 text-xs font-extrabold text-ink-faint uppercase">
                {key === today() ? 'Today' : day.toFormat('ccc d')}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                {occs.slice(0, compact ? 1 : 3).map((occ) => (
                  <span key={occ.key} className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: occurrenceColor(occ, peopleById, calendarsById) }}
                    />
                    <span className={`truncate font-bold ${compact ? 'text-xs' : 'text-sm'}`}>{occ.title}</span>
                    {!occ.allDay && (
                      <span className="shrink-0 text-xs font-bold text-ink-faint">
                        {formatTime(occ.start, settings?.timeFormat ?? '12h')}
                      </span>
                    )}
                  </span>
                ))}
                {occs.length > (compact ? 1 : 3) && (
                  <span className="text-xs font-extrabold text-ink-faint">+{occs.length - (compact ? 1 : 3)} more</span>
                )}
              </span>
            </div>
          )
        })}
        {[...byDay.values()].every((v) => v.length === 0) && <Placeholder>A quiet week so far</Placeholder>}
      </div>
    </div>
  )
}

export function WeatherTile({ tile, compact }: TileProps) {
  const { data: settings } = useSettings()
  const { data: weather } = useWeather()
  if (!settings?.weather) return <Placeholder>Set a location in Settings → General</Placeholder>
  if (!weather) return <Placeholder>Loading forecast…</Placeholder>
  const Icon = weatherIcon(weather.code, weather.isDay)
  const showForecast = tile.w >= 3 && !compact
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 items-center justify-center gap-3">
        <Icon size={compact ? 34 : 44} className="text-ember-deep" />
        <span className={`font-display ${compact ? 'text-4xl' : 'text-5xl'}`}>{weather.temperature}°</span>
      </div>
      {showForecast && (
        <div className="flex shrink-0 justify-around pb-1">
          {weather.daily.slice(0, 4).map((d, i) => {
            const DayIcon = weatherIcon(d.code, true)
            return (
              <span key={d.date} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-extrabold text-ink-faint uppercase">
                  {i === 0 ? 'Now' : DateTime.fromISO(d.date).toFormat('ccc')}
                </span>
                <DayIcon size={16} className="text-ember-deep" />
                <span className="text-xs font-bold">{d.high}°</span>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ChoresProgressTile({ compact }: TileProps) {
  const { data: chores = [] } = useChoresDay(today())
  const { data: people = [] } = usePeople()
  const withChores = people.filter((p) => chores.some((c) => c.personId === p.id))
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TileTitle>Chores today</TileTitle>
      {withChores.length === 0 ? (
        <Placeholder>No chores today</Placeholder>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-hidden">
          {withChores.map((p) => {
            const mine = chores.filter((c) => c.personId === p.id)
            const done = mine.filter((c) => c.completed).length
            const pct = mine.length === 0 ? 0 : Math.round((done / mine.length) * 100)
            return (
              <div key={p.id} className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                  style={{ backgroundColor: p.color, color: textOn(p.color) }}
                >
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  {!compact && <span className="block truncate text-xs font-bold">{p.name}</span>}
                  <span className="block h-2.5 overflow-hidden rounded-full bg-paper-deep">
                    <span
                      className="block h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: p.color }}
                    />
                  </span>
                </span>
                <span className="shrink-0 text-xs font-extrabold text-ink-soft">
                  {done === mine.length ? <CheckIcon size={16} className="text-[#46A758]" /> : `${done}/${mine.length}`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function StarBalancesTile({ compact }: TileProps) {
  const { data: people = [] } = usePeople()
  const { data: balances = [] } = useBalances()
  const kids = people.filter((p) => p.role === 'child')
  const shown = kids.length > 0 ? kids : people
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TileTitle>Stars</TileTitle>
      {shown.length === 0 ? (
        <Placeholder>Add family members in Settings</Placeholder>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden">
          {shown.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                style={{ backgroundColor: p.color, color: textOn(p.color) }}
              >
                {initials(p.name)}
              </span>
              {!compact && <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>}
              <span className={`font-extrabold text-ember-deep ${compact ? 'ml-auto text-sm' : 'text-base'}`}>
                ★ {balances.find((b) => b.personId === p.id)?.balance ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ListTile({ tile, compact }: TileProps) {
  const { data: lists = [] } = useLists()
  const list = lists.find((l) => l.id === tile.config?.listId)
  if (!list) return <Placeholder>List not found — re-add this tile</Placeholder>
  const unchecked = list.items.filter((i) => !i.checked)
  const maxItems = compact ? 4 : 8
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-1.5 flex shrink-0 items-center gap-1.5">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: list.color }} />
        <span className="truncate text-xs font-extrabold tracking-wide text-ink-faint uppercase">{list.name}</span>
      </div>
      {unchecked.length === 0 ? (
        <Placeholder>All done!</Placeholder>
      ) : (
        <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
          {unchecked.slice(0, maxItems).map((item) => (
            <span key={item.id} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full border-2" style={{ borderColor: list.color }} />
              <span className={`truncate font-bold ${compact ? 'text-sm' : 'text-base'}`}>{item.text}</span>
            </span>
          ))}
          {unchecked.length > maxItems && (
            <span className="text-xs font-extrabold text-ink-faint">+{unchecked.length - maxItems} more</span>
          )}
        </div>
      )}
    </div>
  )
}

export function MealsTile({ compact }: TileProps) {
  const { data: meals = [] } = useMeals(today(), today())
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TileTitle>Meals today</TileTitle>
      {meals.length === 0 ? (
        <Placeholder>No meals planned</Placeholder>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-hidden">
          {meals.map((m) => (
            <span key={m.slot} className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                style={{ backgroundColor: SLOT_META[m.slot].color }}
              >
                {SLOT_META[m.slot].letter}
              </span>
              <span className={`truncate font-bold ${compact ? 'text-sm' : 'text-base'}`}>{m.text}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function ClockTile({ compact }: TileProps) {
  const { data: settings } = useSettings()
  const [now, setNow] = useState(() => DateTime.now().setZone(ZONE))
  useEffect(() => {
    const t = setInterval(() => setNow(DateTime.now().setZone(ZONE)), 10_000)
    return () => clearInterval(t)
  }, [])
  const timeFormat = settings?.timeFormat ?? '12h'
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-hidden">
      <span className={`font-display leading-none ${compact ? 'text-4xl' : 'text-5xl'}`}>
        {timeFormat === '24h' ? now.toFormat('HH:mm') : now.toFormat('h:mm')}
      </span>
      <span className="mt-1 text-sm font-bold text-ink-soft">{now.toFormat('ccc, LLL d')}</span>
    </div>
  )
}

export function NewsTile({ tile, compact }: TileProps) {
  const preset = tile.config?.feedId ? presetById(tile.config.feedId) : undefined
  const { data: feed, isError } = useQuery({
    queryKey: ['rss', tile.config?.feedId],
    queryFn: () => ipcInvoke('rss:getFeed', { feedId: tile.config!.feedId! }),
    enabled: !!preset,
    refetchInterval: 15 * 60_000,
    retry: 2
  })
  if (!preset) return <Placeholder>Feed not found — re-add this tile</Placeholder>

  const maxItems = compact ? 3 : Math.max(3, tile.h * 2 - 1)
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TileTitle>{preset.label}</TileTitle>
      {isError && !feed ? (
        <Placeholder>Couldn't load headlines — will retry</Placeholder>
      ) : !feed ? (
        <Placeholder>Loading headlines…</Placeholder>
      ) : (
        <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden">
          {feed.items.slice(0, maxItems).map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
              <span className="min-w-0 flex-1">
                <span
                  className={`block overflow-hidden font-bold text-ellipsis ${compact ? 'text-xs whitespace-nowrap' : 'line-clamp-2 text-sm'}`}
                >
                  {item.title}
                </span>
                {item.publishedAt && !compact && (
                  <span className="block text-[11px] font-bold text-ink-faint">
                    {DateTime.fromISO(item.publishedAt).toRelative()}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PhotoTile({ tile }: TileProps) {
  const { data: photos = [] } = useQuery({
    queryKey: ['screensaverPhotos'],
    queryFn: () => ipcInvoke('screensaver:listPhotos', undefined),
    staleTime: 60_000
  })
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (photos.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % photos.length), 30_000)
    return () => clearInterval(t)
  }, [photos.length])
  if (photos.length === 0) return <Placeholder>Pick a photo folder in Settings → General</Placeholder>
  const src = photos[(index + tile.id.length) % photos.length]
  return (
    <div className="-m-4 h-[calc(100%+2rem)] overflow-hidden">
      <img key={src} src={src} alt="" className="h-full w-full object-cover" style={{ animation: 'fade-in 1s ease backwards' }} />
    </div>
  )
}
