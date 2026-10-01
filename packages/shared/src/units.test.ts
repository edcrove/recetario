import { describe, expect, it } from 'vitest'
import { convertUnit, bestVolumeUnit } from './units.js'

describe('convertUnit - volume', () => {
  it('converts 1 cup to 240 ml', () => {
    expect(convertUnit(1, 'cup', 'ml')).toBe(240)
  })

  it('converts 15 ml to 1 tbsp', () => {
    expect(convertUnit(15, 'ml', 'tbsp')).toBe(1)
  })

  it('converts 1 l to 1000 ml', () => {
    expect(convertUnit(1, 'l', 'ml')).toBe(1000)
  })

  it('converts 2 tbsp to 6 tsp', () => {
    expect(convertUnit(2, 'tbsp', 'tsp')).toBe(6)
  })
})

describe('convertUnit - mass', () => {
  it('converts 1 kg to 1000 g', () => {
    expect(convertUnit(1, 'kg', 'g')).toBe(1000)
  })

  it('converts 500 g to 0.5 kg', () => {
    expect(convertUnit(500, 'g', 'kg')).toBe(0.5)
  })
})

describe('convertUnit - pass-through', () => {
  it('returns null when qty is null', () => {
    expect(convertUnit(null, 'cup', 'ml')).toBeNull()
  })

  it('returns qty unchanged for cross-dimension (no density)', () => {
    expect(convertUnit(2, 'cup', 'g')).toBe(2)
  })

  it('returns qty unchanged for same count unit', () => {
    expect(convertUnit(1, 'unit', 'unit')).toBe(1)
  })

  it('returns qty unchanged for same unit', () => {
    expect(convertUnit(1, 'cup', 'cup')).toBe(1)
  })

  it('returns qty unchanged when from is null', () => {
    expect(convertUnit(1, null, 'ml')).toBe(1)
  })

  it('returns qty unchanged when to is null', () => {
    expect(convertUnit(1, 'ml', null)).toBe(1)
  })
})

describe('bestVolumeUnit', () => {
  it('imperial: spoons for small amounts, cups otherwise', () => {
    expect(bestVolumeUnit(5, 'imperial')).toBe('tsp')
    expect(bestVolumeUnit(30, 'imperial')).toBe('tbsp')
    expect(bestVolumeUnit(500, 'imperial')).toBe('cup')
  })
  it('metric: liters from 1000 ml', () => {
    expect(bestVolumeUnit(240, 'metric')).toBe('ml')
    expect(bestVolumeUnit(1500, 'metric')).toBe('l')
  })
})
