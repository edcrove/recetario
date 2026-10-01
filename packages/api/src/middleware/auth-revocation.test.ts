import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const { userRows, selectThrows } = vi.hoisted(() => ({
  userRows: { current: [] as unknown[] },
  selectThrows: { current: false },
}))

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            selectThrows.current
              ? Promise.reject(new Error('db down'))
              : Promise.resolve(userRows.current),
        }),
      }),
    }),
  })),
  schema: { users: { id: 'id', passwordChangedAt: 'password_changed_at' }, apiKeys: {} },
}))

import { authMiddleware } from './auth.js'
import { signJwt } from '../auth/service.js'

const app = new Hono()
app.use('*', authMiddleware)
app.get('/me', (c) => c.text(c.get('ownerId')))

const call = (token: string) =>
  app.request('/me', { headers: { Authorization: `Bearer ${token}` } })

describe('JWT revocation after a password reset', () => {
  beforeEach(() => {
    userRows.current = []
    selectThrows.current = false
  })

  it('accepts a token when the password never changed', async () => {
    userRows.current = [{ passwordChangedAt: null }]
    const token = await signJwt({ sub: 'u1', email: 'a@b.c' })
    const res = await call(token)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('u1')
  })

  it('rejects a token issued before the password was reset', async () => {
    const token = await signJwt({ sub: 'u1', email: 'a@b.c' })
    userRows.current = [{ passwordChangedAt: new Date(Date.now() + 60_000) }]
    const res = await call(token)
    expect(res.status).toBe(401)
    expect((await res.json()).error).toMatch(/sign in again/)
  })

  it('accepts a token issued after the reset', async () => {
    userRows.current = [{ passwordChangedAt: new Date(Date.now() - 60_000) }]
    const token = await signJwt({ sub: 'u1', email: 'a@b.c' })
    expect((await call(token)).status).toBe(200)
  })

  it('does not revoke on a lookup error or a missing user row', async () => {
    const token = await signJwt({ sub: 'u1', email: 'a@b.c' })
    selectThrows.current = true
    expect((await call(token)).status).toBe(200)
    selectThrows.current = false
    userRows.current = []
    expect((await call(token)).status).toBe(200)
  })
})
