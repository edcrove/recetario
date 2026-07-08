import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const url = process.env['DATABASE_URL']
    if (!url) throw new Error('DATABASE_URL is not set')
    const client = postgres(url)
    _db = drizzle(client, { schema })
  }
  return _db
}

export { schema }

// Nulls the cached drizzle client so the next getDb() call opens a fresh
// connection — for unit tests re-exercising getDb()'s own init/singleton
// logic against mocked postgres/drizzle modules (see db/index.test.ts).
// This does NOT touch actual Postgres data. Integration tests wanting a
// clean database between files must use resetTestDb() from
// __tests__/integration/globalSetup.ts instead.
export function resetDb() {
  _db = null
}
