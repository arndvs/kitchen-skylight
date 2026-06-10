import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { runMigrations } from './migrations'
import { uuidv7 } from '@shared/uuid'

export type AppDb = BetterSQLite3Database<typeof schema>

export interface DbHandle {
  sqlite: Database.Database
  db: AppDb
}

export function openDatabase(dbPath: string): DbHandle {
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  runMigrations(sqlite)
  const db = drizzle(sqlite, { schema })
  seedDefaults(db)
  return { sqlite, db }
}

/** First-run defaults: one local "Family" calendar so the app is usable immediately. */
function seedDefaults(db: AppDb): void {
  const existing = db.select({ id: schema.calendars.id }).from(schema.calendars).limit(1).all()
  if (existing.length === 0) {
    db.insert(schema.calendars)
      .values({
        id: uuidv7(),
        provider: 'local',
        name: 'Family',
        color: '#0091FF',
        readOnly: false,
        visible: true
      })
      .run()
  }
}
