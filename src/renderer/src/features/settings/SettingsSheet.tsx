import { useState } from 'react'
import type { CalendarDto, PersonDto, PersonRole } from '@shared/types'
import { PERSON_COLORS } from '@shared/types'
import {
  useCalendarMutations,
  useCalendars,
  usePeople,
  usePeopleMutations,
  useSettings,
  useSettingsMutation
} from '../../api/hooks'
import { useUi } from '../../stores/uiStore'
import { BigButton, Dialog, FieldLabel, SegmentedControl, Sheet, Toggle } from '../../components/ui'
import { OskInput } from '../../components/Osk'
import { PlusIcon } from '../../components/icons'
import { initials, textOn } from '../../lib/format'

type Tab = 'family' | 'calendars' | 'general'

export function SettingsSheet() {
  const open = useUi((s) => s.settingsOpen)
  const setOpen = useUi((s) => s.setSettingsOpen)
  const [tab, setTab] = useState<Tab>('family')

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Settings" wide>
      <div className="mb-5">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'family', label: 'Family' },
            { value: 'calendars', label: 'Calendars' },
            { value: 'general', label: 'General' }
          ]}
        />
      </div>
      {tab === 'family' && <FamilyTab />}
      {tab === 'calendars' && <CalendarsTab />}
      {tab === 'general' && <GeneralTab />}
    </Sheet>
  )
}

function ColorGrid({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERSON_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`pressable h-12 w-12 rounded-full ${value === c ? 'ring-4 ring-ink ring-offset-2 ring-offset-card' : ''}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

function FamilyTab() {
  const { data: people = [] } = usePeople()
  const mutations = usePeopleMutations()
  const [editing, setEditing] = useState<PersonDto | 'new' | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PERSON_COLORS[0])
  const [role, setRole] = useState<PersonRole>('child')

  const openEditor = (p: PersonDto | 'new'): void => {
    setEditing(p)
    if (p === 'new') {
      setName('')
      setColor(PERSON_COLORS[people.length % PERSON_COLORS.length])
      setRole('child')
    } else {
      setName(p.name)
      setColor(p.color)
      setRole(p.role)
    }
  }

  const save = (): void => {
    if (!name.trim()) return
    if (editing === 'new') mutations.create.mutate({ name: name.trim(), color, role })
    else if (editing) mutations.update.mutate({ id: editing.id, name: name.trim(), color, role })
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {people.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => openEditor(p)}
          className="pressable flex items-center gap-4 rounded-2xl bg-paper-deep/50 p-3 text-left hover:bg-paper-deep"
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-extrabold"
            style={{ backgroundColor: p.color, color: textOn(p.color) }}
          >
            {initials(p.name)}
          </span>
          <span className="flex-1">
            <span className="block text-xl font-bold">{p.name}</span>
            <span className="block text-sm font-bold text-ink-faint capitalize">{p.role}</span>
          </span>
        </button>
      ))}
      <BigButton variant="ghost" onClick={() => openEditor('new')}>
        <span className="flex items-center justify-center gap-2">
          <PlusIcon size={20} /> Add family member
        </span>
      </BigButton>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add family member' : 'Edit family member'}
      >
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Name</FieldLabel>
            <OskInput value={name} onChange={setName} placeholder="Name" autoFocus={editing === 'new'} />
          </div>
          <div>
            <FieldLabel>Color</FieldLabel>
            <ColorGrid value={color} onChange={setColor} />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <SegmentedControl
              value={role}
              onChange={setRole}
              options={[
                { value: 'parent', label: 'Parent' },
                { value: 'child', label: 'Child' }
              ]}
            />
          </div>
          <div className="mt-2 flex gap-3">
            {editing !== 'new' && editing && (
              <BigButton
                variant="danger"
                onClick={() => {
                  mutations.remove.mutate({ id: editing.id })
                  setEditing(null)
                }}
              >
                Remove
              </BigButton>
            )}
            <div className="flex-1" />
            <BigButton variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </BigButton>
            <BigButton onClick={save} disabled={!name.trim()}>
              Save
            </BigButton>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function CalendarsTab() {
  const { data: calendars = [] } = useCalendars()
  const mutations = useCalendarMutations()
  const [editing, setEditing] = useState<CalendarDto | 'new' | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PERSON_COLORS[5])

  const openEditor = (c: CalendarDto | 'new'): void => {
    setEditing(c)
    setName(c === 'new' ? '' : c.name)
    setColor(c === 'new' ? PERSON_COLORS[5] : c.color)
  }

  const save = (): void => {
    if (!name.trim()) return
    if (editing === 'new') mutations.create.mutate({ name: name.trim(), color })
    else if (editing) mutations.update.mutate({ id: editing.id, name: name.trim(), color })
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {calendars.map((c) => (
        <div key={c.id} className="flex items-center gap-4 rounded-2xl bg-paper-deep/50 p-3">
          <button type="button" onClick={() => openEditor(c)} className="pressable flex flex-1 items-center gap-4 text-left">
            <span className="h-8 w-8 rounded-full" style={{ backgroundColor: c.color }} />
            <span className="flex-1">
              <span className="block text-xl font-bold">{c.name}</span>
              <span className="block text-sm font-bold text-ink-faint capitalize">{c.provider}</span>
            </span>
          </button>
          <Toggle checked={c.visible} onChange={(visible) => mutations.update.mutate({ id: c.id, visible })} label="Visible" />
        </div>
      ))}
      <BigButton variant="ghost" onClick={() => openEditor('new')}>
        <span className="flex items-center justify-center gap-2">
          <PlusIcon size={20} /> Add local calendar
        </span>
      </BigButton>
      <p className="px-1 text-sm font-semibold text-ink-faint">
        Google Calendar sync and ICS feeds are coming in the next milestone.
      </p>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add calendar' : 'Edit calendar'}>
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Name</FieldLabel>
            <OskInput value={name} onChange={setName} placeholder="Calendar name" autoFocus={editing === 'new'} />
          </div>
          <div>
            <FieldLabel>Color</FieldLabel>
            <ColorGrid value={color} onChange={setColor} />
          </div>
          <div className="mt-2 flex gap-3">
            {editing !== 'new' && editing && (
              <BigButton
                variant="danger"
                onClick={() => {
                  mutations.remove.mutate({ id: editing.id })
                  setEditing(null)
                }}
              >
                Delete
              </BigButton>
            )}
            <div className="flex-1" />
            <BigButton variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </BigButton>
            <BigButton onClick={save} disabled={!name.trim()}>
              Save
            </BigButton>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function GeneralTab() {
  const { data: settings } = useSettings()
  const mutation = useSettingsMutation()
  if (!settings) return null
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <FieldLabel>Week starts on</FieldLabel>
        <SegmentedControl
          value={String(settings.weekStartsOn) as '0' | '1'}
          onChange={(v) => mutation.mutate({ weekStartsOn: Number(v) as 0 | 1 })}
          options={[
            { value: '0', label: 'Sunday' },
            { value: '1', label: 'Monday' }
          ]}
        />
      </div>
      <div>
        <FieldLabel>Time format</FieldLabel>
        <SegmentedControl
          value={settings.timeFormat}
          onChange={(timeFormat) => mutation.mutate({ timeFormat })}
          options={[
            { value: '12h', label: '12-hour' },
            { value: '24h', label: '24-hour' }
          ]}
        />
      </div>
      <p className="text-sm font-semibold text-ink-faint">
        Weather, sleep schedule, screensaver, and parental lock arrive in upcoming milestones.
      </p>
    </div>
  )
}
