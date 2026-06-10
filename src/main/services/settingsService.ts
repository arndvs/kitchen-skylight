import { eq } from 'drizzle-orm'
import type { AppDb } from '../db/client'
import { settings } from '../db/schema'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types'

export function createSettingsService(db: AppDb) {
  function getAll(): AppSettings {
    const rows = db.select().from(settings).all()
    const stored: Record<string, unknown> = {}
    for (const row of rows) {
      try {
        stored[row.key] = JSON.parse(row.value)
      } catch {
        // ignore corrupt values; defaults win
      }
    }
    return { ...DEFAULT_SETTINGS, ...stored } as AppSettings
  }

  function set(patch: Partial<AppSettings>): AppSettings {
    db.transaction((tx) => {
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue
        const json = JSON.stringify(value)
        const existing = tx.select().from(settings).where(eq(settings.key, key)).all()
        if (existing.length > 0) {
          tx.update(settings).set({ value: json }).where(eq(settings.key, key)).run()
        } else {
          tx.insert(settings).values({ key, value: json }).run()
        }
      }
    })
    return getAll()
  }

  return { getAll, set }
}

export type SettingsService = ReturnType<typeof createSettingsService>
