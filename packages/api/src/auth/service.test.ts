import { describe, it, expect, vi } from 'vitest'
import { hashPassword, verifyPassword, signJwt, verifyJwt } from './service.js'

describe('hashPassword / verifyPassword', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('mysecret')
    expect(hash).not.toBe('mysecret')
    expect(await verifyPassword('mysecret', hash)).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('produces different hashes for same input (salt)', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a).not.toBe(b)
  })
})

describe('signJwt / verifyJwt', () => {
  const payload = { sub: '550e8400-e29b-41d4-a716-446655440000', email: 'test@test.com' }

  it('signs and verifies a token', async () => {
    const token = await signJwt(payload)
    const verified = await verifyJwt(token)
    expect(verified?.sub).toBe(payload.sub)
    expect(verified?.email).toBe(payload.email)
  })

  it('returns null for invalid token', async () => {
    expect(await verifyJwt('not.a.token')).toBeNull()
  })

  it('returns null for tampered token', async () => {
    const token = await signJwt(payload)
    const tampered = token.slice(0, -3) + 'xyz'
    expect(await verifyJwt(tampered)).toBeNull()
  })

  it('includes householdId when provided', async () => {
    const token = await signJwt({ ...payload, householdId: 'hh-123' })
    const verified = await verifyJwt(token)
    expect(verified?.householdId).toBe('hh-123')
  })

  // Mutation testing (2026-10-01): the 7-day lifetime could be changed or
  // dropped without a test failing.
  it('tokens last seven days and are refused after that', async () => {
    vi.useFakeTimers()
    try {
      const T = Date.UTC(2026, 9, 1, 12, 0, 0)
      vi.setSystemTime(T)
      const token = await signJwt({ sub: 'u1', email: 'a@b.c' })
      const claims = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString())
      expect(claims.exp - claims.iat).toBe(7 * 24 * 60 * 60)

      vi.setSystemTime(T + 7 * 24 * 60 * 60 * 1000 - 60_000)
      expect(await verifyJwt(token)).not.toBeNull()
      vi.setSystemTime(T + 7 * 24 * 60 * 60 * 1000 + 60_000)
      expect(await verifyJwt(token)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
