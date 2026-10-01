import { describe, expect, it } from 'vitest'
import { scaleQuantity, isCountUnit, roundCount } from './scaling.js'

describe('scaleQuantity', () => {
  it('scales up (200 * 8/4 = 400)', () => {
    expect(scaleQuantity(200, 4, 8)).toBe(400)
  })

  it('scales down (200 * 2/4 = 100)', () => {
    expect(scaleQuantity(200, 4, 2)).toBe(100)
  })

  it('passes null through unchanged', () => {
    expect(scaleQuantity(null, 4, 8)).toBeNull()
  })

  it('rounds to 2 decimals (1 * 1/3 = 0.33)', () => {
    expect(scaleQuantity(1, 3, 1)).toBe(0.33)
  })

  it('throws when baseServings is 0', () => {
    expect(() => scaleQuantity(100, 0, 4)).toThrow('baseServings must be > 0')
  })

  it('returns same value when baseServings equals targetServings', () => {
    expect(scaleQuantity(150, 4, 4)).toBe(150)
  })
})

describe('count units', () => {
  it('treats bare counts and unit/clove/slice as counts', () => {
    expect(isCountUnit(null)).toBe(true)
    expect(isCountUnit(undefined)).toBe(true)
    expect(isCountUnit('clove')).toBe(true)
    expect(isCountUnit('g')).toBe(false)
  })

  it('snaps to halves and never rounds a positive amount to zero', () => {
    expect(roundCount(1.33)).toBe(1.5)
    expect(roundCount(1.2)).toBe(1)
    expect(roundCount(0.2)).toBe(0.5)
    expect(roundCount(3)).toBe(3)
    expect(roundCount(0)).toBe(0)
  })
})
