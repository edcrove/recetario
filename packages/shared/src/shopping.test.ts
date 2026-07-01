import { describe, it, expect } from 'vitest'
import { aggregateIngredients } from './shopping.js'
import type { ScaledIngredient } from './shopping.js'

describe('aggregateIngredients', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateIngredients([])).toEqual([])
  })

  it('returns single ingredient unchanged', () => {
    const result = aggregateIngredients([{ name: 'pasta', quantity: 200, unit: 'g' }])
    expect(result).toEqual([{ ingredient: 'pasta', quantity: 200, unit: 'g' }])
  })

  it('sums same ingredient + same unit', () => {
    const result = aggregateIngredients([
      { name: 'pasta', quantity: 200, unit: 'g' },
      { name: 'pasta', quantity: 150, unit: 'g' },
    ])
    expect(result).toEqual([{ ingredient: 'pasta', quantity: 350, unit: 'g' }])
  })

  it('sums same ingredient + same unit (volume)', () => {
    const result = aggregateIngredients([
      { name: 'milk', quantity: 1, unit: 'cup' },
      { name: 'milk', quantity: 2, unit: 'cup' },
    ])
    expect(result).toEqual([{ ingredient: 'milk', quantity: 3, unit: 'cup' }])
  })

  it('normalizes name case when summing', () => {
    const result = aggregateIngredients([
      { name: 'Pasta', quantity: 100, unit: 'g' },
      { name: 'pasta', quantity: 50, unit: 'g' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]!.quantity).toBe(150)
  })

  it('merges mass units (g + kg) → g', () => {
    const result = aggregateIngredients([
      { name: 'flour', quantity: 500, unit: 'g' },
      { name: 'flour', quantity: 1, unit: 'kg' },
    ])
    expect(result).toEqual([{ ingredient: 'flour', quantity: 1500, unit: 'g' }])
  })

  it('merges volume units (cup + ml) → ml', () => {
    const result = aggregateIngredients([
      { name: 'water', quantity: 1, unit: 'cup' },
      { name: 'water', quantity: 100, unit: 'ml' },
    ])
    expect(result).toEqual([{ ingredient: 'water', quantity: 340, unit: 'ml' }])
  })

  it('merges cross-dimension (volume + mass) using density for known ingredient', () => {
    // flour: density 0.53 g/ml — 1 cup flour = 240 * 0.53 = 127.2g
    const result = aggregateIngredients([
      { name: 'flour', quantity: 1, unit: 'cup' },
      { name: 'flour', quantity: 100, unit: 'g' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]!.unit).toBe('g')
    expect(result[0]!.quantity).toBeCloseTo(100 + 240 * 0.53, 1)
  })

  it('keeps cross-dimension as separate lines for unknown ingredient', () => {
    const result = aggregateIngredients([
      { name: 'mystery spice', quantity: 1, unit: 'cup' },
      { name: 'mystery spice', quantity: 100, unit: 'g' },
    ])
    expect(result).toHaveLength(2)
  })

  // regression: bug 404 — zero-quantity items from scaling were appearing in the list
  it('filters out zero-quantity items (e.g. scaled to 0 servings)', () => {
    const result = aggregateIngredients([{ name: 'salt', quantity: 0, unit: 'g' }])
    expect(result).toHaveLength(0)
  })

  it('filters out negative-quantity items', () => {
    const result = aggregateIngredients([{ name: 'sugar', quantity: -1, unit: 'g' }])
    expect(result).toHaveLength(0)
  })

  it('keeps null-quantity items as "al gusto" — user still needs to buy some', () => {
    const result = aggregateIngredients([
      { name: 'salt', quantity: null, unit: null },
      { name: 'salt', quantity: null, unit: null },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]!.quantity).toBeNull()
  })

  it('keeps measurable items when mixed with null-qty of same ingredient (different units)', () => {
    const result = aggregateIngredients([
      { name: 'pepper', quantity: null, unit: null },
      { name: 'pepper', quantity: 2, unit: 'g' },
    ])
    // null goes into __null__ key, 2g goes into g key — two separate groups
    const withQty = result.find((r) => r.quantity !== null)
    expect(withQty).toBeDefined()
    expect(withQty!.quantity).toBe(2)
  })

  it('sorts results alphabetically by ingredient', () => {
    const ingredients: ScaledIngredient[] = [
      { name: 'zucchini', quantity: 1, unit: 'unit' },
      { name: 'apple', quantity: 2, unit: 'unit' },
      { name: 'mango', quantity: 3, unit: 'unit' },
    ]
    const result = aggregateIngredients(ingredients)
    expect(result.map((r) => r.ingredient)).toEqual(['apple', 'mango', 'zucchini'])
  })

  it('handles count/unknown units as-is (not merged into mass/volume)', () => {
    const result = aggregateIngredients([
      { name: 'egg', quantity: 2, unit: 'unit' },
      { name: 'egg', quantity: 3, unit: 'unit' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]!.quantity).toBe(5)
    expect(result[0]!.unit).toBe('unit')
  })

  it('aggregates multiple recipes (multiple entries for same ingredient)', () => {
    const result = aggregateIngredients([
      { name: 'tomato', quantity: 200, unit: 'g' },
      { name: 'tomato', quantity: 150, unit: 'g' },
      { name: 'onion', quantity: 1, unit: 'unit' },
      { name: 'tomato', quantity: 100, unit: 'g' },
    ])
    expect(result).toHaveLength(2)
    const tomato = result.find((r) => r.ingredient === 'tomato')
    expect(tomato!.quantity).toBe(450)
  })

  it('keeps null-quantity item separate from mass item for same ingredient (tryMerge otherItems)', () => {
    // "salt" with qty=null (to taste) and a measured amount — different keys, tryMerge is called
    const result = aggregateIngredients([
      { name: 'salt', quantity: null, unit: null },
      { name: 'salt', quantity: 5, unit: 'g' },
    ])
    // mass item → 5g; null item → to taste — both should appear
    expect(result.length).toBe(2)
    expect(result.some((r) => r.quantity === null)).toBe(true)
    expect(result.some((r) => r.quantity === 5 && r.unit === 'g')).toBe(true)
  })

  it('keeps count-unit item alongside mass item (otherItems path in tryMerge)', () => {
    // "egg" with unit 'unit' (count) AND unit null — different keys, tryMerge called
    const result = aggregateIngredients([
      { name: 'egg', quantity: 2, unit: 'unit' },
      { name: 'egg', quantity: 1, unit: null },
    ])
    expect(result.length).toBe(2)
    expect(result.some((r) => r.unit === 'unit')).toBe(true)
    expect(result.some((r) => r.unit === null)).toBe(true)
  })
})
