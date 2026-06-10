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
}

export type IpcChannel = keyof IpcContract
export type IpcReq<K extends IpcChannel> = IpcContract[K]['req']
export type IpcRes<K extends IpcChannel> = IpcContract[K]['res']

/** Channel prefixes the preload bridge will allow through. */
export const ALLOWED_CHANNEL_PREFIXES = ['app:', 'settings:', 'people:', 'calendars:', 'events:'] as const

/** Envelope used for every invoke result so errors cross the bridge cleanly. */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }
