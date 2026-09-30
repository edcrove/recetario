import { describe, it, expect, vi } from 'vitest'

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(),
  schema: { users: { email: 'email', id: 'id' } },
}))

import { generateTempPassword, resetPassword } from './reset-password.js'
import { verifyPassword } from '../auth/service.js'

function fakeDb(rows: Array<{ id: string }>) {
  const set = vi.fn()
  const db = {
    update: () => ({
      set: (values: unknown) => {
        set(values)
        return { where: () => ({ returning: () => Promise.resolve(rows) }) }
      },
    }),
  }
  return { db: db as never, set }
}

describe('generateTempPassword', () => {
  it('returns 12 unambiguous characters by default', () => {
    const p = generateTempPassword()
    expect(p).toHaveLength(12)
    expect(p).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/)
  })

  it('differs between calls', () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword())
  })
})

describe('resetPassword', () => {
  it('stores a bcrypt hash of the returned temporary password', async () => {
    const { db, set } = fakeDb([{ id: 'u1' }])
    const temp = await resetPassword(' someone@example.com ', db)
    expect(temp).toHaveLength(12)
    const { passwordHash } = set.mock.calls[0]![0] as { passwordHash: string }
    expect(await verifyPassword(temp!, passwordHash)).toBe(true)
  })

  it('returns null when no user has that email', async () => {
    const { db } = fakeDb([])
    expect(await resetPassword('nobody@example.com', db)).toBeNull()
  })
})
