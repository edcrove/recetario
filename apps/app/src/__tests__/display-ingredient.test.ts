import { describe, it, expect } from 'vitest'
import { formatQuantity, displayIngredient, unitLabel } from '../utils/displayIngredient'
import type { Ingredient } from '@recetario/shared'

// regression: bug 403 — units were shown in English
describe('unitLabel', () => {
  it.each([
    ['tsp', 'cdta'],
    ['tbsp', 'cda'],
    ['cup', 'taza'],
    ['unit', 'u'],
    ['pinch', 'pizca'],
    ['slice', 'rodaja'],
    ['clove', 'diente'],
    ['g', 'g'],
    ['kg', 'kg'],
    ['ml', 'ml'],
    ['l', 'l'],
  ])('translates %s → %s', (input, expected) => {
    expect(unitLabel(input)).toBe(expected)
  })

  it('passes through unknown units unchanged', () => {
    expect(unitLabel('oz')).toBe('oz')
  })

  it('returns empty string for null/undefined', () => {
    expect(unitLabel(null)).toBe('')
    expect(unitLabel(undefined)).toBe('')
  })
})

describe('formatQuantity', () => {
  it('returns c/n for null', () => {
    expect(formatQuantity(null)).toBe('c/n')
  })

  it('returns integer for whole numbers', () => {
    expect(formatQuantity(3)).toBe('3')
  })

  it('trims trailing zeros', () => {
    expect(formatQuantity(1.5)).toBe('1.5')
    expect(formatQuantity(2.1)).toBe('2.1')
  })
})

describe('displayIngredient', () => {
  const flour: Ingredient = { name: 'Harina', quantity: 200, unit: 'g' }

  it('cooking mode: keeps original units', () => {
    const result = displayIngredient(flour, 4, 4, 'cooking')
    expect(result).toBe('200 g Harina')
  })

  it('scales with different servings', () => {
    const result = displayIngredient(flour, 4, 8, 'cooking')
    expect(result).toBe('400 g Harina')
  })

  it('metric mode: converts cooking units to ml', () => {
    const ing: Ingredient = { name: 'Leche', quantity: 1, unit: 'cup' }
    const result = displayIngredient(ing, 1, 1, 'metric')
    expect(result).toContain('ml')
  })

  it('imperial mode: converts ml to tsp and shows cdta label', () => {
    const ing: Ingredient = { name: 'Agua', quantity: 5, unit: 'ml' }
    const result = displayIngredient(ing, 1, 1, 'imperial')
    expect(result).toContain('cdta')
  })

  it('imperial mode: converts l to cup and shows taza label', () => {
    const ing: Ingredient = { name: 'Caldo', quantity: 1, unit: 'l' }
    const result = displayIngredient(ing, 1, 1, 'imperial')
    expect(result).toContain('taza')
  })

  it('handles null quantity (al gusto)', () => {
    const salt: Ingredient = { name: 'Sal', quantity: null, unit: null }
    expect(displayIngredient(salt, 4, 4, 'cooking')).toBe('c/n Sal')
  })

  it('includes presentation', () => {
    const ing: Ingredient = { ...flour, presentation: 'tamizada' }
    expect(displayIngredient(ing, 4, 4, 'cooking')).toBe('200 g tamizada Harina')
  })

  it('appends note in parentheses', () => {
    const ing: Ingredient = { ...flour, note: 'sin TACC' }
    expect(displayIngredient(ing, 4, 4, 'cooking')).toBe('200 g Harina (sin TACC)')
  })

  it('metric mode: keeps mass units unchanged', () => {
    const result = displayIngredient(flour, 4, 4, 'metric')
    expect(result).toBe('200 g Harina')
  })

  it('imperial mode: keeps non-convertible units unchanged', () => {
    const result = displayIngredient(flour, 4, 4, 'imperial')
    expect(result).toBe('200 g Harina')
  })
})
