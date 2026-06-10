import { useState } from 'react'
import type { CalendarDto, PersonDto, PersonRole } from '@shared/types'
import { PERSON_COLORS } from '@shared/types'
import {
  useAuthMutations,
  useAuthStatus,
  useCalendarMutations,
  useCalendars,
  useCitySearch,
  useGoogleMutations,
  useGoogleStatus,
  useIcsMutations,
  usePeople,
  usePeopleMutations,
  useRemoteCalendars,
  useSettings,
  useSettingsMutation,
  useSyncNow,
  useSyncStatus
} from '../../api/hooks'
import { PinDialog } from '../../components/PinDialog'
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
  const { data: auth } = useAuthStatus()
  const authMutations = useAuthMutations()

  const close = (): void => {
    setOpen(false)
    // closing settings re-arms the parental lock immediately
    if (auth?.pinSet) authMutations.lock.mutate(undefined)
  }

  return (
    <Sheet open={open} onClose={close} title="Settings" wide>
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

function SyncStatusRow() {
  const { data: status } = useSyncStatus()
  const syncNow = useSyncNow()
  if (!status) return null
  const dot = status.state === 'error' ? 'bg-ember' : status.state === 'syncing' ? 'bg-sun' : 'bg-[#46A758]'
  const label =
    status.state === 'syncing' ? 'Syncing…' : status.state === 'error' ? (status.lastError ?? 'Sync error') : 'Up to date'
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-paper-deep/50 px-4 py-3">
      <span className={`h-3.5 w-3.5 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1 truncate text-base font-bold text-ink-soft">{label}</span>
      <button
        type="button"
        onClick={() => syncNow.mutate(undefined)}
        className="pressable rounded-full border-2 border-line bg-card px-4 py-1.5 text-sm font-bold text-ink-soft"
      >
        Sync now
      </button>
    </div>
  )
}

function GoogleSection() {
  const { data: status } = useGoogleStatus()
  const google = useGoogleMutations()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const { data: remoteCals = [], isLoading: remoteLoading } = useRemoteCalendars(expandedAccount)

  if (!status) return null

  const saveAndConnect = (): void => {
    google.setCredentials.mutate(
      { clientId, clientSecret },
      { onSuccess: () => google.connect.mutate(undefined) }
    )
  }

  return (
    <div>
      <FieldLabel>Google Calendar</FieldLabel>
      {!status.configured ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-paper-deep/50 p-4">
          <p className="text-base font-semibold text-ink-soft">
            Two-way sync uses your own (free) Google Cloud project. Create a{' '}
            <span className="font-extrabold">Desktop app</span> OAuth client in the Google Cloud console, enable the
            Calendar API, and paste the credentials here.
          </p>
          <OskInput value={clientId} onChange={setClientId} placeholder="OAuth client ID" />
          <OskInput value={clientSecret} onChange={setClientSecret} placeholder="OAuth client secret" />
          <BigButton onClick={saveAndConnect} disabled={clientId.trim().length < 10 || clientSecret.trim().length < 5}>
            {google.connect.isPending ? 'Waiting for browser sign-in…' : 'Save & connect Google'}
          </BigButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {status.accounts.map((account) => (
            <div key={account.id} className="rounded-2xl bg-paper-deep/50 p-3">
              <div className="flex items-center gap-3">
                <span className="flex-1">
                  <span className="block text-lg font-bold">{account.email}</span>
                  {account.error && <span className="block text-sm font-bold text-ember-deep">{account.error}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)}
                  className="pressable rounded-full border-2 border-line bg-card px-4 py-1.5 text-sm font-bold text-ink-soft"
                >
                  {expandedAccount === account.id ? 'Hide calendars' : 'Choose calendars'}
                </button>
                <button
                  type="button"
                  onClick={() => google.disconnect.mutate({ accountId: account.id })}
                  className="pressable rounded-full border-2 border-ember-soft px-4 py-1.5 text-sm font-bold text-ember-deep"
                >
                  Disconnect
                </button>
              </div>
              {expandedAccount === account.id && (
                <div className="mt-3 flex flex-col gap-2">
                  {remoteLoading && <p className="text-sm font-bold text-ink-faint">Loading calendars…</p>}
                  {remoteCals.map((rc) => (
                    <div key={rc.id} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2">
                      <span className="h-5 w-5 rounded-full" style={{ backgroundColor: rc.color }} />
                      <span className="min-w-0 flex-1 truncate text-base font-bold">
                        {rc.name}
                        {rc.readOnly && <span className="ml-2 text-xs font-extrabold text-ink-faint">READ-ONLY</span>}
                      </span>
                      <Toggle
                        checked={rc.selected}
                        onChange={(selected) =>
                          google.setCalendarSelected.mutate({
                            accountId: account.id,
                            googleCalendarId: rc.id,
                            name: rc.name,
                            color: rc.color,
                            readOnly: rc.readOnly,
                            selected
                          })
                        }
                        label={`Sync ${rc.name}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <BigButton variant="ghost" onClick={() => google.connect.mutate(undefined)} disabled={google.connect.isPending}>
            {google.connect.isPending ? 'Waiting for browser sign-in…' : 'Add Google account'}
          </BigButton>
        </div>
      )}
    </div>
  )
}

function IcsSection() {
  const { data: calendars = [] } = useCalendars()
  const calendarMutations = useCalendarMutations()
  const ics = useIcsMutations()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const feeds = calendars.filter((c) => c.provider === 'ics')

  const add = (): void => {
    ics.add.mutate(
      { url: url.trim(), name: name.trim() || 'Subscribed calendar', color: PERSON_COLORS[9] },
      {
        onSuccess: () => {
          setUrl('')
          setName('')
        }
      }
    )
  }

  return (
    <div>
      <FieldLabel>Subscribed feeds (ICS)</FieldLabel>
      <div className="flex flex-col gap-2">
        {feeds.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-paper-deep/50 p-3">
            <span className="h-6 w-6 rounded-full" style={{ backgroundColor: c.color }} />
            <span className="min-w-0 flex-1 truncate text-lg font-bold">{c.name}</span>
            <Toggle
              checked={c.visible}
              onChange={(visible) => calendarMutations.update.mutate({ id: c.id, visible })}
              label="Visible"
            />
            <button
              type="button"
              onClick={() => calendarMutations.remove.mutate({ id: c.id })}
              className="pressable rounded-full border-2 border-ember-soft px-4 py-1.5 text-sm font-bold text-ember-deep"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex flex-col gap-2 rounded-2xl bg-paper-deep/50 p-3 sm:flex-row">
          <OskInput value={url} onChange={setUrl} placeholder="https://… .ics feed URL" className="flex-[2]" />
          <OskInput value={name} onChange={setName} placeholder="Name" className="flex-1" />
          <BigButton variant="ghost" onClick={add} disabled={!/^https?:\/\/.+/.test(url.trim()) || ics.add.isPending}>
            Add
          </BigButton>
        </div>
      </div>
    </div>
  )
}

function CalendarsTab() {
  const { data: calendars = [] } = useCalendars()
  const mutations = useCalendarMutations()
  const [editing, setEditing] = useState<CalendarDto | 'new' | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PERSON_COLORS[5])
  const manageable = calendars.filter((c) => c.provider !== 'ics')

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
    <div className="flex flex-col gap-6">
      <SyncStatusRow />
      <GoogleSection />
      <IcsSection />
      <div>
        <FieldLabel>Calendars on this display</FieldLabel>
        <div className="flex flex-col gap-2">
          {manageable.map((c) => (
            <div key={c.id} className="flex items-center gap-4 rounded-2xl bg-paper-deep/50 p-3">
              <button
                type="button"
                onClick={() => openEditor(c)}
                className="pressable flex flex-1 items-center gap-4 text-left"
              >
                <span className="h-8 w-8 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="flex-1">
                  <span className="block text-xl font-bold">{c.name}</span>
                  <span className="block text-sm font-bold text-ink-faint capitalize">{c.provider}</span>
                </span>
              </button>
              <Toggle
                checked={c.visible}
                onChange={(visible) => mutations.update.mutate({ id: c.id, visible })}
                label="Visible"
              />
            </div>
          ))}
          <BigButton variant="ghost" onClick={() => openEditor('new')}>
            <span className="flex items-center justify-center gap-2">
              <PlusIcon size={20} /> Add local calendar
            </span>
          </BigButton>
        </div>
      </div>

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

function WeatherSection() {
  const { data: settings } = useSettings()
  const mutation = useSettingsMutation()
  const search = useCitySearch()
  const [query, setQuery] = useState('')
  if (!settings) return null

  return (
    <div>
      <FieldLabel>Weather</FieldLabel>
      <div className="flex flex-col gap-3 rounded-2xl bg-paper-deep/50 p-4">
        {settings.weather ? (
          <div className="flex items-center gap-3">
            <span className="flex-1 text-lg font-bold">{settings.weather.label}</span>
            <button
              type="button"
              onClick={() => mutation.mutate({ weather: null })}
              className="pressable rounded-full border-2 border-ember-soft px-4 py-1.5 text-sm font-bold text-ember-deep"
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-base font-semibold text-ink-soft">Pick a location to show the forecast in the header.</p>
        )}
        <div className="flex gap-2">
          <OskInput value={query} onChange={setQuery} placeholder="Search city…" className="flex-1" />
          <BigButton variant="ghost" onClick={() => search.mutate(query)} disabled={query.trim().length < 2 || search.isPending}>
            Search
          </BigButton>
        </div>
        {search.data && (
          <div className="flex flex-col gap-1.5">
            {search.data.length === 0 && <p className="text-sm font-bold text-ink-faint">No places found</p>}
            {search.data.map((city) => (
              <button
                key={`${city.lat},${city.lon}`}
                type="button"
                onClick={() => {
                  mutation.mutate({ weather: city })
                  search.reset()
                  setQuery('')
                }}
                className="pressable rounded-xl bg-card px-4 py-2.5 text-left text-base font-bold hover:bg-sun-soft"
              >
                {city.label}
              </button>
            ))}
          </div>
        )}
        <div>
          <FieldLabel>Units</FieldLabel>
          <SegmentedControl
            value={settings.temperatureUnit}
            onChange={(temperatureUnit) => mutation.mutate({ temperatureUnit })}
            options={[
              { value: 'f', label: '°F' },
              { value: 'c', label: '°C' }
            ]}
          />
        </div>
      </div>
    </div>
  )
}

function ParentalLockSection() {
  const { data: auth } = useAuthStatus()
  const authMutations = useAuthMutations()
  const [step, setStep] = useState<null | 'new' | 'confirm'>(null)
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!auth) return null

  return (
    <div>
      <FieldLabel>Parental lock</FieldLabel>
      <div className="flex flex-col gap-3 rounded-2xl bg-paper-deep/50 p-4">
        <p className="text-base font-semibold text-ink-soft">
          {auth.pinSet
            ? 'A PIN is required to open settings and manage calendars, people, and sync.'
            : 'Set a PIN so kids can use the calendar but not change settings.'}
        </p>
        <div className="flex gap-3">
          <BigButton
            variant="ghost"
            onClick={() => {
              setError(null)
              setStep('new')
            }}
          >
            {auth.pinSet ? 'Change PIN' : 'Set PIN'}
          </BigButton>
          {auth.pinSet && (
            <BigButton variant="danger" onClick={() => authMutations.setPin.mutate({ pin: null })}>
              Remove PIN
            </BigButton>
          )}
        </div>
      </div>

      <PinDialog
        open={step !== null}
        title={step === 'confirm' ? 'Enter it once more' : 'Choose a PIN (4–8 digits)'}
        error={error}
        onClose={() => setStep(null)}
        onSubmit={(pin) => {
          if (step === 'new') {
            setFirstPin(pin)
            setError(null)
            setStep('confirm')
          } else if (pin === firstPin) {
            authMutations.setPin.mutate({ pin })
            setStep(null)
          } else {
            setError("PINs didn't match — start again")
            setStep('new')
          }
        }}
      />
    </div>
  )
}

function GeneralTab() {
  const { data: settings } = useSettings()
  const mutation = useSettingsMutation()
  if (!settings) return null
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <WeatherSection />
      <ParentalLockSection />
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
        Sleep schedule and the photo screensaver arrive in upcoming milestones.
      </p>
    </div>
  )
}
