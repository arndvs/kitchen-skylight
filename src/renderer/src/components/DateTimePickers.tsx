import { useState } from 'react'
import { DateTime } from 'luxon'
import { Dialog, FieldLabel } from './ui'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { ZONE } from '../stores/uiStore'

const WEEKDAY_HEADERS: Record<0 | 1, string[]> = {
  0: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  1: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
}

export function MiniMonth({
  selected,
  onSelect,
  weekStartsOn
}: {
  selected: string
  onSelect: (date: string) => void
  weekStartsOn: 0 | 1
}) {
  const [cursor, setCursor] = useState(() => DateTime.fromISO(selected, { zone: ZONE }).startOf('month'))
  const today = DateTime.now().setZone(ZONE).toISODate()

  const first = cursor.startOf('month')
  // walk back to the week start
  const target = weekStartsOn === 0 ? 7 : 1
  let gridStart = first
  while (gridStart.weekday !== target) gridStart = gridStart.minus({ days: 1 })

  const days: DateTime[] = []
  for (let i = 0; i < 42; i++) days.push(gridStart.plus({ days: i }))

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="pressable flex h-12 w-12 items-center justify-center rounded-full hover:bg-paper-deep"
          onClick={() => setCursor(cursor.minus({ months: 1 }))}
        >
          <ChevronLeftIcon />
        </button>
        <div className="font-display text-xl font-semibold">{cursor.toFormat('LLLL yyyy')}</div>
        <button
          type="button"
          className="pressable flex h-12 w-12 items-center justify-center rounded-full hover:bg-paper-deep"
          onClick={() => setCursor(cursor.plus({ months: 1 }))}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_HEADERS[weekStartsOn].map((h, i) => (
          <div key={i} className="py-1 text-xs font-extrabold text-ink-faint">
            {h}
          </div>
        ))}
        {days.map((d) => {
          const iso = d.toISODate()!
          const isSelected = iso === selected
          const isCursorMonth = d.month === cursor.month
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={`pressable mx-auto flex h-11 w-11 items-center justify-center rounded-full text-base font-bold ${
                isSelected
                  ? 'bg-ember text-white'
                  : iso === today
                    ? 'bg-sun-soft text-ember-deep'
                    : isCursorMonth
                      ? 'text-ink hover:bg-paper-deep'
                      : 'text-ink-faint'
              }`}
            >
              {d.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateField({
  label,
  value,
  onChange,
  weekStartsOn
}: {
  label: string
  value: string
  onChange: (date: string) => void
  weekStartsOn: 0 | 1
}) {
  const [open, setOpen] = useState(false)
  const d = DateTime.fromISO(value, { zone: ZONE })
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable min-h-14 w-full rounded-2xl border-2 border-line bg-card px-4 text-left text-xl font-semibold hover:border-ember-soft"
      >
        {d.toFormat('ccc, LLL d, yyyy')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <MiniMonth
          selected={value}
          weekStartsOn={weekStartsOn}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
        />
      </Dialog>
    </div>
  )
}

function minutesLabel(minutes: number, timeFormat: '12h' | '24h'): string {
  const d = DateTime.fromObject({ hour: Math.floor(minutes / 60), minute: minutes % 60 })
  return timeFormat === '24h' ? d.toFormat('HH:mm') : d.toFormat('h:mm a').toLowerCase()
}

export function TimeField({
  label,
  minutes,
  onChange,
  timeFormat
}: {
  label: string
  /** minutes since local midnight */
  minutes: number
  onChange: (minutes: number) => void
  timeFormat: '12h' | '24h'
}) {
  const options: number[] = []
  for (let m = 0; m < 24 * 60; m += 15) options.push(m)
  if (!options.includes(minutes)) {
    options.push(minutes)
    options.sort((a, b) => a - b)
  }
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={minutes}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-14 w-full appearance-none rounded-2xl border-2 border-line bg-card px-4 text-xl font-semibold focus:border-ember focus:outline-none"
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {minutesLabel(m, timeFormat)}
          </option>
        ))}
      </select>
    </div>
  )
}
