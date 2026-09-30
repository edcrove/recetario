import { describe, it, expect } from 'vitest'
import { assertProductionConfig, productionConfigErrors, registrationOpen } from './production.js'

const HEX_128 = 'a'.repeat(64) + '0123456789abcdef'.repeat(4)
const prod = (env: Record<string, string>) => ({ NODE_ENV: 'production', ...env })

describe('productionConfigErrors', () => {
  it('checks nothing outside production', () => {
    expect(productionConfigErrors({ NODE_ENV: 'development' })).toEqual([])
    expect(productionConfigErrors({})).toEqual([])
  })

  it('accepts a long random hex secret with no DEV_API_KEY', () => {
    expect(productionConfigErrors(prod({ JWT_SECRET: HEX_128 }))).toEqual([])
  })

  it('requires JWT_SECRET, even with ALLOW_DEV_SECRETS', () => {
    expect(productionConfigErrors(prod({}))[0]).toMatch(/JWT_SECRET is not set/)
    expect(productionConfigErrors(prod({ ALLOW_DEV_SECRETS: 'true' }))).toHaveLength(1)
  })

  it('rejects the placeholders that ship in the repo', () => {
    for (const s of [
      'dev-secret-change-in-production',
      'change-me-in-production-use-64-random-hex-chars',
    ]) {
      expect(productionConfigErrors(prod({ JWT_SECRET: s }))[0]).toMatch(/placeholder/)
    }
  })

  it('rejects short or non-hex secrets', () => {
    expect(productionConfigErrors(prod({ JWT_SECRET: 'abc123' }))[0]).toMatch(/64 hex/)
    expect(productionConfigErrors(prod({ JWT_SECRET: 'z'.repeat(80) }))[0]).toMatch(/64 hex/)
  })

  it('refuses DEV_API_KEY', () => {
    expect(productionConfigErrors(prod({ JWT_SECRET: HEX_128, DEV_API_KEY: 'k' }))).toEqual([
      expect.stringMatching(/DEV_API_KEY/),
    ])
  })

  it('ALLOW_DEV_SECRETS keeps only the "secret is set" check (docker-compose, CI)', () => {
    expect(
      productionConfigErrors(
        prod({ JWT_SECRET: 'ci-secret', DEV_API_KEY: 'k', ALLOW_DEV_SECRETS: 'true' }),
      ),
    ).toEqual([])
  })
})

describe('assertProductionConfig', () => {
  it('throws every problem at once', () => {
    expect(() => assertProductionConfig(prod({ JWT_SECRET: 'short', DEV_API_KEY: 'k' }))).toThrow(
      /Refusing to start:\n- JWT_SECRET must be at least 64 hex[\s\S]*\n- DEV_API_KEY/,
    )
  })

  it('passes a valid config', () => {
    expect(() => assertProductionConfig(prod({ JWT_SECRET: HEX_128 }))).not.toThrow()
  })

  it('reads process.env by default', () => {
    expect(() => assertProductionConfig()).not.toThrow()
    expect(registrationOpen()).toBe(true)
  })
})

describe('registrationOpen', () => {
  it('is closed by default in production and open elsewhere', () => {
    expect(registrationOpen({ NODE_ENV: 'production' })).toBe(false)
    expect(registrationOpen({ NODE_ENV: 'development' })).toBe(true)
  })

  it('REGISTRATION_OPEN overrides the default either way', () => {
    expect(registrationOpen({ NODE_ENV: 'production', REGISTRATION_OPEN: 'true' })).toBe(true)
    expect(registrationOpen({ NODE_ENV: 'development', REGISTRATION_OPEN: 'false' })).toBe(false)
  })
})
