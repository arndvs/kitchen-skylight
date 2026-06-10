import { DateTime } from 'luxon'
import { eachDay } from '@shared/dates'
import { useSettings } from '../../api/hooks'
import { useUi, ZONE } from '../../stores/uiStore'
import { occurrenceColor } from '../../lib/colors'
import { isToday } from '../../lib/format'
import { EventCard } from './EventCard'
import { useCalendarData, useViewRange } from './useCalendarData'
import { PlusIcon } from '../../components/icons'

export function WeekView() {
  const range = useViewRange()
  const { byDay, peopleById, calendarsById } = useCalendarData(range)
  const { data: settings } = useSettings()
  const openCreate = useUi((s) => s.openCreate)
  const openEdit = useUi((s) => s.openEdit)
  const timeFormat = settings?.timeFormat ?? '12h'
  const days = eachDay(range, ZONE)

  return (
    <div className="grid h-full grid-cols-7 gap-3 px-6 pb-6">
      {days.map((day, i) => {
        const key = day.toISODate()!
        const occurrences = byDay.get(key) ?? []
        const today = isToday(key)
        return (
          <div
            key={key}
            className={`animate-rise flex min-h-0 flex-col rounded-card p-2 ${
              today ? 'bg-sun-soft shadow-card ring-2 ring-sun' : 'bg-paper-deep/40'
            }`}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <button
              type="button"
              onClick={() => openCreate(key)}
              className="pressable group mb-2 flex items-baseline gap-2 rounded-xl px-2 py-1"
            >
              <span className={`text-sm font-extrabold uppercase ${today ? 'text-ember-deep' : 'text-ink-faint'}`}>
                {day.toFormat('ccc')}
              </span>
              <span
                className={`font-display text-3xl ${
                  today
                    ? 'flex h-11 w-11 items-center justify-center rounded-full bg-ember leading-none text-white'
                    : 'text-ink'
                }`}
              >
                {day.day}
              </span>
              <PlusIcon size={16} className="ml-auto text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            <div
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
              onClick={(e) => {
                if (e.target === e.currentTarget) openCreate(key)
              }}
            >
              {occurrences.map((occ) => (
                <EventCard
                  key={occ.key}
                  occ={occ}
                  color={occurrenceColor(occ, peopleById, calendarsById)}
                  timeFormat={timeFormat}
                  peopleById={peopleById}
                  onTap={() => openEdit(occ)}
                />
              ))}
              {occurrences.length === 0 && (
                <div className="flex-1" onClick={() => openCreate(key)} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function dayLabel(dateIso: string): string {
  return DateTime.fromISO(dateIso, { zone: ZONE }).toFormat('cccc, LLLL d')
}
