import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const dbPath = process.env.THINKZEN_DB_PATH ?? 'thinkzen.db'
declare global {
  // eslint-disable-next-line no-var
  var __thinkzenSqlite__: Database.Database | undefined
  // eslint-disable-next-line no-var
  var __thinkzenDrizzle__:
    | ReturnType<typeof drizzle<typeof schema>>
    | undefined
}
const sqlite = globalThis.__thinkzenSqlite__ ?? new Database(dbPath)
const db = globalThis.__thinkzenDrizzle__ ?? drizzle(sqlite, { schema })
globalThis.__thinkzenSqlite__ = sqlite
globalThis.__thinkzenDrizzle__ = db
export { sqlite, db }