import { describe, it, expect } from 'vitest'
import { scaleQuantity, convertUnit } from '@recetario/shared'

describe('scaleQuantity', () => {
  it('scales 200g flour from 4→8 servings → 400g', () => {
    expect(scaleQuantity(200, 4, 8)).toBe(400)
  })

  it('null quantity (to taste) returns null', () => {
    expect(scaleQuantity(null, 4, 8)).toBeNull()
  })

  it('scales fractional amounts correctly', () => {
    expect(scaleQuantity(1, 4, 6)).toBe(1.5)
  })
})

describe('convertUnit', () => {
  it('converts 1 cup to metric → 240 ml', () => {
    expect(convertUnit(1, 'cup', 'ml')).toBe(240)
  })

  it('converts 5 ml to tsp → 1 tsp', () => {
    expect(convertUnit(5, 'ml', 'tsp')).toBe(1)
  })

  it('passes through null quantity', () => {
    expect(convertUnit(null, 'cup', 'ml')).toBeNull()
  })

  it('same unit returns same value', () => {
    expect(convertUnit(200, 'g', 'g')).toBe(200)
  })

  it('count units pass through unchanged (no conversion)', () => {
    expect(convertUnit(3, 'unit', 'clove')).toBe(3)
  })
})

describe('displayIngredient formatQuantity logic', () => {
  function formatQuantity(qty: number | null): string {
    if (qty === null) return 'c/n'
    if (qty === Math.floor(qty)) return String(qty)
    return qty.toFixed(2).replace(/\.?0+$/, '')
  }

  it('returns "c/n" for null quantity', () => {
    expect(formatQuantity(null)).toBe('c/n')
  })

  it('returns integer string for whole numbers', () => {
    expect(formatQuantity(4)).toBe('4')
  })

  it('strips trailing zeros from decimals', () => {
    expect(formatQuantity(1.5)).toBe('1.5')
    expect(formatQuantity(1.0)).toBe('1')
  })
})
