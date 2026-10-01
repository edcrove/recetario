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
    expect(convertWithDensity(1, 'cup', 'g', 'dragon fruit')).toBeNull()
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

  it('returns qty unchanged when from equals to (same unit)', () => {
    expect(convertWithDensity(1, 'cup', 'cup', 'flour')).toBe(1)
  })

  it('returns qty unchanged when from is null', () => {
    expect(convertWithDensity(1, null, 'g', 'flour')).toBe(1)
  })

  it('returns qty unchanged when to is null', () => {
    expect(convertWithDensity(1, 'ml', null, 'water')).toBe(1)
  })
})

describe('Spanish ingredient names', () => {
  it('finds densities regardless of accents, case and plurals', () => {
    expect(lookupDensity('Harina')).toBe(0.53)
    expect(lookupDensity('AZUCAR')).toBe(0.85)
    expect(lookupDensity('Azúcar negra')).toBe(0.72)
    expect(lookupDensity('Leches')).toBe(1.03)
  })

  it('drops trailing qualifiers until a known name matches', () => {
    expect(lookupDensity('harina 0000')).toBe(0.53)
    expect(lookupDensity('aceite de oliva extra virgen')).toBe(0.92)
    expect(lookupDensity('pimienta negra')).toBeNull()
  })

  it('converts a cup of harina to grams instead of passing the number through', () => {
    expect(convertWithDensity(1, 'cup', 'g', 'harina')).toBeCloseTo(127.2, 1)
  })
})
