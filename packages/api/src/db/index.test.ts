import { describe, it, expect, afterEach } from 'vitest'

vi.mock('postgres', () => ({
  default: vi.fn(() => ({})),
}))
vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({})),
}))

import { vi } from 'vitest'
import { getDb, resetDb } from './index.js'

describe('getDb', () => {
  afterEach(() => {
    resetDb()
  })

  it('throws when DATABASE_URL is not set', () => {
    const saved = process.env['DATABASE_URL']
    delete process.env['DATABASE_URL']
    expect(() => getDb()).toThrow('DATABASE_URL is not set')
    if (saved !== undefined) process.env['DATABASE_URL'] = saved
  })

  it('returns a db instance when DATABASE_URL is set', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test'
    const db = getDb()
    expect(db).toBeDefined()
  })

  it('returns the same instance on repeated calls (singleton)', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test'
    const db1 = getDb()
    const db2 = getDb()
    expect(db1).toBe(db2)
  })
})
