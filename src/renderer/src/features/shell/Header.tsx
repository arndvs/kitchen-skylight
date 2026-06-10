import { useEffect, useState } from 'react'
import { DateTime } from 'luxon'
import { usePeople, useSettings } from '../../api/hooks'
import { useUi, ZONE } from '../../stores/uiStore'
import { SegmentedControl, IconButton } from '../../components/ui'
import { ChevronLeftIcon, ChevronRightIcon, GearIcon, PlusIcon } from '../../components/icons'
import { initials, textOn } from '../../lib/format'
import type { CalendarViewKind } from '@shared/types'

function useNow(): DateTime {
  const [now, setNow] = useState(() => DateTime.now().setZone(ZONE))
  useEffect(() => {
    const t = setInterval(() => setNow(DateTime.now().setZone(ZONE)), 20_000)
    return () => clearInterval(t)
  }, [])
  return now
}

function periodLabel(view: CalendarViewKind, focusedDate: string, weekStartsOn: 0 | 1): string {
  const d = DateTime.fromISO(focusedDate, { zone: ZONE })
  if (view === 'day') return d.toFormat('LLL d')
  if (view === 'month') return d.toFormat('LLLL yyyy')
  if (view === 'agenda') return `From ${d.toFormat('LLL d')}`
  const target = weekStartsOn === 0 ? 7 : 1
  let start = d
  while (start.weekday !== target) start = start.minus({ days: 1 })
  const end = start.plus({ days: 6 })
  return start.month === end.month
    ? `${start.toFormat('LLL d')} – ${end.toFormat('d')}`
    : `${start.toFormat('LLL d')} – ${end.toFormat('LLL d')}`
}

export function Header() {
  const now = useNow()
  const { data: settings } = useSettings()
  const { data: people = [] } = usePeople()
  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)
  const focusedDate = useUi((s) => s.focusedDate)
  const step = useUi((s) => s.step)
  const goToday = useUi((s) => s.goToday)
  const hiddenPeople = useUi((s) => s.hiddenPeople)
  const togglePerson = useUi((s) => s.togglePerson)
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)
  const weekStartsOn = settings?.weekStartsOn ?? 0
  const timeFormat = settings?.timeFormat ?? '12h'

  return (
    <header className="flex items-center gap-5 px-6 pt-5 pb-4">
      {/* Today, big and warm */}
      <button type="button" onClick={goToday} className="pressable shrink-0 text-left">
        <div className="font-display text-[2.6rem] leading-none font-semibold tracking-tight">
          {now.toFormat('cccc')}
        </div>
        <div className="mt-1 text-lg font-bold text-ink-soft">
          {now.toFormat('LLLL d')}
          <span className="mx-2 text-ink-faint">·</span>
          {timeFormat === '24h' ? now.toFormat('HH:mm') : now.toFormat('h:mm a').toLowerCase()}
        </div>
      </button>

      <div className="flex-1" />

      {/* person filter chips */}
      {people.length > 0 && (
        <div className="flex max-w-[34rem] items-center gap-2 overflow-x-auto">
          {people.map((p) => {
            const hidden = hiddenPeople.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePerson(p.id)}
                className={`pressable flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-base font-bold transition-all ${
                  hidden ? 'bg-paper-deep text-ink-faint opacity-60' : 'shadow-card'
                }`}
                style={hidden ? undefined : { backgroundColor: p.color, color: textOn(p.color) }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold"
                  style={{
                    backgroundColor: hidden ? 'var(--color-line)' : 'rgba(255,255,255,0.28)',
                    color: hidden ? 'var(--color-ink-soft)' : 'inherit'
                  }}
                >
                  {initials(p.name)}
                </span>
                {p.name}
              </button>
            )
          })}
        </div>
      )}

      {/* period nav */}
      <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-paper-deep/70 p-1">
        <IconButton label="Previous" onClick={() => step(-1)}>
          <ChevronLeftIcon />
        </IconButton>
        <button
          type="button"
          onClick={goToday}
          className="pressable min-w-28 rounded-xl px-2 py-2 text-center text-base font-extrabold text-ink"
        >
          {periodLabel(view, focusedDate, weekStartsOn)}
        </button>
        <IconButton label="Next" onClick={() => step(1)}>
          <ChevronRightIcon />
        </IconButton>
      </div>

      <SegmentedControl
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'agenda', label: 'List' }
        ]}
      />

      <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
        <GearIcon size={26} />
      </IconButton>
    </header>
  )
}

export function Fab() {
  const openCreate = useUi((s) => s.openCreate)
  return (
    <button
      type="button"
      aria-label="Add event"
      onClick={() => openCreate()}
      className="pressable fixed right-7 bottom-7 z-30 flex h-18 w-18 items-center justify-center rounded-full bg-ember text-white shadow-float hover:bg-ember-deep"
    >
      <PlusIcon size={32} />
    </button>
  )
}
