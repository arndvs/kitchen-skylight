import type {
  AppSettings,
  CalendarCreateInput,
  CalendarDto,
  CalendarUpdateInput,
  EventCreateInput,
  EventDeleteInput,
  EventDto,
  EventUpdateInput,
  OccurrenceDto,
  PersonCreateInput,
  PersonDto,
  PersonUpdateInput
} from '../types'

/**
 * The single source of truth for renderer <-> main communication.
 * Every operation appears here once; main registers a zod-validated handler per
 * channel and the renderer gets a fully typed `ipcInvoke`.
 */
export type IpcContract = {
  'app:getInfo': { req: void; res: { version: string; platform: string; zone: string } }

  'settings:getAll': { req: void; res: AppSettings }
  'settings:set': { req: { patch: Partial<AppSettings> }; res: AppSettings }

  'people:list': { req: void; res: PersonDto[] }
  'people:create': { req: PersonCreateInput; res: PersonDto }
  'people:update': { req: PersonUpdateInput; res: PersonDto }
  'people:delete': { req: { id: string }; res: void }

  'calendars:list': { req: void; res: CalendarDto[] }
  'calendars:create': { req: CalendarCreateInput; res: CalendarDto }
  'calendars:update': { req: CalendarUpdateInput; res: CalendarDto }
  'calendars:delete': { req: { id: string }; res: void }

  'events:getOccurrences': { req: { start: string; end: string }; res: OccurrenceDto[] }
  'events:get': { req: { id: string }; res: EventDto | null }
  'events:create': { req: EventCreateInput; res: EventDto }
  'events:update': { req: EventUpdateInput; res: void }
  'events:delete': { req: EventDeleteInput; res: void }

  'google:getStatus': {
    req: void
    res: { configured: boolean; accounts: { id: string; email: string; error: string | null }[] }
  }
  'google:setCredentials': { req: { clientId: string; clientSecret: string }; res: void }
  'google:connect': { req: void; res: { email: string } }
  'google:disconnect': { req: { accountId: string }; res: void }
  'google:listRemoteCalendars': {
    req: { accountId: string }
    res: { id: string; name: string; color: string; primary: boolean; readOnly: boolean; selected: boolean }[]
  }
  'google:setCalendarSelected': {
    req: {
      accountId: string
      googleCalendarId: string
      name: string
      color: string
      readOnly: boolean
      selected: boolean
    }
    res: void
  }

  'ics:add': { req: { url: string; name: string; color: string }; res: CalendarDto }

  'weather:get': {
    req: void
    res: {
      temperature: number
      code: number
      isDay: boolean
      unit: 'f' | 'c'
      label: string
      daily: { date: string; code: number; high: number; low: number; precipProb: number | null }[]
      fetchedAt: string
    } | null
  }
  'weather:searchCity': { req: { query: string }; res: { label: string; lat: number; lon: number }[] }

  'auth:getStatus': { req: void; res: { pinSet: boolean; unlocked: boolean } }
  'auth:verifyPin': { req: { pin: string }; res: { valid: boolean } }
  'auth:setPin': { req: { pin: string | null }; res: void }
  'auth:lock': { req: void; res: void }

  'sync:now': { req: void; res: void }
  'sync:getStatus': {
    req: void
    res: {
      state: 'idle' | 'syncing' | 'error'
      lastError: string | null
      calendars: {
        id: string
        name: string
        provider: string
        lastSyncedAt: string | null
        syncError: string | null
      }[]
    }
  }
}

export type IpcChannel = keyof IpcContract
export type IpcReq<K extends IpcChannel> = IpcContract[K]['req']
export type IpcRes<K extends IpcChannel> = IpcContract[K]['res']

/** Channel prefixes the preload bridge will allow through. */
export const ALLOWED_CHANNEL_PREFIXES = [
  'app:',
  'settings:',
  'people:',
  'calendars:',
  'events:',
  'google:',
  'ics:',
  'sync:',
  'weather:',
  'auth:'
] as const

/** Envelope used for every invoke result so errors cross the bridge cleanly. */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
