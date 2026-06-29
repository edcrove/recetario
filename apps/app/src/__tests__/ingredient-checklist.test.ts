import { describe, it, expect } from 'vitest'
import { formatQty, formatIngredient } from '../utils/ingredientFormat'
import type { Ingredient } from '@recetario/shared'

describe('formatQty', () => {
  it('returns c/n for null quantity', () => {
    expect(formatQty(null)).toBe('c/n')
  })

  it('returns integer string for whole numbers', () => {
    expect(formatQty(2)).toBe('2')
    expect(formatQty(100)).toBe('100')
  })

  it('formats decimals without trailing zeros', () => {
    expect(formatQty(1.5)).toBe('1.5')
    expect(formatQty(0.33)).toBe('0.33')
    expect(formatQty(2.1)).toBe('2.1')
  })

  it('handles zero', () => {
    expect(formatQty(0)).toBe('0')
  })
})

describe('formatIngredient', () => {
  const base: Ingredient = {
    name: 'Harina',
    quantity: 200,
    unit: 'g',
  }

  it('formats basic ingredient with qty, unit, name', () => {
    expect(formatIngredient(base, 4, 4)).toBe('200 g Harina')
  })

  it('scales quantity when servings differ', () => {
    expect(formatIngredient(base, 4, 8)).toBe('400 g Harina')
  })

  it('includes presentation when present', () => {
    const ing: Ingredient = { ...base, presentation: 'tamizada' }
    expect(formatIngredient(ing, 4, 4)).toBe('200 g tamizada Harina')
  })

  it('includes note in parentheses', () => {
    const ing: Ingredient = { ...base, note: 'sin TACC' }
    expect(formatIngredient(ing, 4, 4)).toBe('200 g Harina (sin TACC)')
  })

  it('handles null quantity (al gusto)', () => {
    const ing: Ingredient = { name: 'Sal', quantity: null, unit: null }
    expect(formatIngredient(ing, 4, 4)).toBe('c/n Sal')
  })

  it('handles ingredient with no unit', () => {
    const ing: Ingredient = { name: 'Huevos', quantity: 3, unit: null }
    expect(formatIngredient(ing, 4, 4)).toBe('3 Huevos')
  })
})
