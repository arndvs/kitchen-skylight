import { app, ipcMain, BrowserWindow } from 'electron'
import { DateTime } from 'luxon'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'
import type { IpcChannel, IpcContract, IpcResult } from '@shared/ipc/contract'
import * as s from '@shared/ipc/schemas'
import { AppError } from '../services/errors'
import type { SettingsService } from '../services/settingsService'
import type { PeopleService } from '../services/peopleService'
import type { CalendarService } from '../services/calendarService'
import type { EventService } from '../services/eventService'
import type { GoogleAuth } from '../sync/googleAuth'
import type { GoogleSync } from '../sync/googleSync'
import type { IcsSync } from '../sync/icsSync'
import type { SyncManager } from '../sync/scheduler'

export interface Services {
  settings: SettingsService
  people: PeopleService
  calendars: CalendarService
  events: EventService
  googleAuth: GoogleAuth
  googleSync: GoogleSync
  icsSync: IcsSync
  syncManager: SyncManager
}

/** Channels that mutate data, mapped to the domain the renderer should refetch. */
const MUTATION_DOMAINS: Partial<Record<IpcChannel, 'events' | 'people' | 'calendars' | 'settings'>> = {
  'settings:set': 'settings',
  'people:create': 'people',
  'people:update': 'people',
  'people:delete': 'people',
  'calendars:create': 'calendars',
  'calendars:update': 'calendars',
  'calendars:delete': 'calendars',
  'events:create': 'events',
  'events:update': 'events',
  'events:delete': 'events',
  'google:connect': 'calendars',
  'google:disconnect': 'calendars',
  'google:setCalendarSelected': 'calendars',
  'ics:add': 'calendars'
}

export function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function registerIpcHandlers(services: Services): void {
  function handle<K extends IpcChannel>(
    channel: K,
    schema: ZodType | null,
    fn: (req: IpcContract[K]['req']) => IpcContract[K]['res'] | Promise<IpcContract[K]['res']>
  ): void {
    ipcMain.handle(channel, async (_event, payload): Promise<IpcResult<IpcContract[K]['res']>> => {
      try {
        const req = (schema ? schema.parse(payload) : payload) as IpcContract[K]['req']
        const data = await fn(req)
        const domain = MUTATION_DOMAINS[channel]
        if (domain) broadcast('push:dataChanged', { domain })
        return { ok: true, data }
      } catch (err) {
        if (err instanceof AppError) {
          return { ok: false, error: { code: err.code, message: err.message } }
        }
        if (err instanceof ZodError) {
          return { ok: false, error: { code: 'INVALID', message: err.issues[0]?.message ?? 'Invalid input' } }
        }
        console.error(`[ipc] ${channel} failed:`, err)
        return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong' } }
      }
    })
  }

  handle('app:getInfo', null, () => ({
    version: app.getVersion(),
    platform: process.platform,
    zone: DateTime.local().zoneName ?? 'UTC'
  }))

  handle('settings:getAll', null, () => services.settings.getAll())
  handle('settings:set', s.settingsPatchSchema, (req) => services.settings.set(req.patch))

  handle('people:list', null, () => services.people.list())
  handle('people:create', s.personCreateSchema, (req) => services.people.create(req))
  handle('people:update', s.personUpdateSchema, (req) => services.people.update(req))
  handle('people:delete', s.idSchema, (req) => services.people.remove(req.id))

  handle('calendars:list', null, () => services.calendars.list())
  handle('calendars:create', s.calendarCreateSchema, (req) => services.calendars.create(req))
  handle('calendars:update', s.calendarUpdateSchema, (req) => services.calendars.update(req))
  handle('calendars:delete', s.idSchema, (req) => services.calendars.remove(req.id))

  handle('events:getOccurrences', s.occurrenceQuerySchema, (req) => services.events.getOccurrences(req))
  handle('events:get', s.idSchema, (req) => services.events.getEvent(req.id))
  handle('events:create', s.eventCreateSchema, (req) => services.events.create(req))
  handle('events:update', s.eventUpdateSchema, (req) => services.events.update(req))
  handle('events:delete', s.eventDeleteSchema, (req) => services.events.remove(req))

  handle('google:getStatus', null, () => ({
    configured: services.googleAuth.isConfigured(),
    accounts: services.googleAuth.listAccounts()
  }))
  handle('google:setCredentials', s.googleCredentialsSchema, (req) =>
    services.googleAuth.setCredentials(req.clientId, req.clientSecret)
  )
  handle('google:connect', null, async () => {
    const result = await services.googleAuth.connect()
    services.syncManager.syncNow()
    return result
  })
  handle('google:disconnect', s.accountIdSchema, (req) => services.googleAuth.disconnect(req.accountId))
  handle('google:listRemoteCalendars', s.accountIdSchema, (req) =>
    services.googleSync.listRemoteCalendars(req.accountId)
  )
  handle('google:setCalendarSelected', s.googleCalendarSelectSchema, (req) => {
    services.googleSync.setCalendarSelected(req)
    if (req.selected) services.syncManager.syncNow()
  })

  handle('ics:add', s.icsAddSchema, (req) => {
    const row = services.icsSync.addFeed(req)
    services.syncManager.syncNow()
    return {
      id: row.id,
      provider: row.provider,
      name: row.name,
      color: row.color,
      readOnly: row.readOnly,
      visible: row.visible
    }
  })

  handle('sync:now', null, () => services.syncManager.syncNow())
  handle('sync:getStatus', null, () => services.syncManager.getStatus())
}
