import { describe, expect, it } from 'vitest'
import { convertWithDensity, lookupDensity } from './density.js'

describe('lookupDensity', () => {
  it('returns density for known ingredient', () => {
    expect(lookupDensity('flour')).toBe(0.53)
  })

  it('is case insensitive', () => {
    expect(lookupDensity('Flour')).toBe(0.53)
  })

  it('returns null for unknown ingredient', () => {
    expect(lookupDensity('dragon fruit')).toBeNull()
  })
})

describe('convertWithDensity', () => {
  it('converts 1 cup flour to ~127.2 g (240ml * 0.53)', () => {
    expect(convertWithDensity(1, 'cup', 'g', 'flour')).toBeCloseTo(127.2, 1)
  })

  it('converts 125 g flour to ~0.983 cups (125/0.53/240)', () => {
    expect(convertWithDensity(125, 'g', 'cup', 'flour')).toBeCloseTo(0.983, 2)
  })

  it('returns qty unchanged for unknown ingredient (pass-through)', () => {
    expect(convertWithDensity(1, 'cup', 'g', 'dragon fruit')).toBe(1)
  })

  it('returns null when qty is null', () => {
    expect(convertWithDensity(null, 'cup', 'g', 'flour')).toBeNull()
  })

  it('converts 500 ml water to 500 g (density 1.0)', () => {
    expect(convertWithDensity(500, 'ml', 'g', 'water')).toBe(500)
  })

  it('converts 1 cup to 240 ml within-dimension (no ingredient needed)', () => {
    expect(convertWithDensity(1, 'cup', 'ml', undefined)).toBe(240)
  })
})
