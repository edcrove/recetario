import { describe, it, expect } from 'vitest'
import { deviceTimeZone, timezoneToSync } from '../utils/timezone'

describe('timezoneToSync', () => {
  it('replaces the untouched default with the device zone', () => {
    expect(timezoneToSync(null, 'America/Montevideo')).toBe('America/Montevideo')
    expect(timezoneToSync(undefined, 'America/Montevideo')).toBe('America/Montevideo')
    expect(timezoneToSync('UTC', 'America/Montevideo')).toBe('America/Montevideo')
  })
  it('never overwrites a zone set on purpose, and skips no-ops', () => {
    expect(timezoneToSync('Europe/Madrid', 'America/Montevideo')).toBeNull()
    expect(timezoneToSync('UTC', 'UTC')).toBeNull()
    expect(timezoneToSync(null, null)).toBeNull()
  })
})

describe('deviceTimeZone', () => {
  it('returns an IANA zone name', () => {
    expect(deviceTimeZone()).toMatch(/\w/)
  })
})
