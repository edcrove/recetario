import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  assertJwtSecretConfigured,
} from './service.js'

describe('assertJwtSecretConfigured', () => {
  it('does not throw in test/development environment (NODE_ENV=test)', () => {
    // In test env, the check is skipped regardless of JWT_SECRET value
    expect(() => assertJwtSecretConfigured()).not.toThrow()
  })

  it('throws with helpful message when called in production with insecure default', () => {
    const originalEnv = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'production'
    // RAW_JWT_SECRET is module-level and resolves to the default at import time in tests
    expect(() => assertJwtSecretConfigured()).toThrow('JWT_SECRET env var is not set')
    process.env['NODE_ENV'] = originalEnv
  })
})

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
})
