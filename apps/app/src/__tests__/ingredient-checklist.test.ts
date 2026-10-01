import { describe, it, expect } from 'vitest'
import { displayIngredient } from '../utils/displayIngredient'
import type { Ingredient } from '@recetario/shared'

// The cook-mode checklist renders with displayIngredient (cooking mode by default).
const formatIngredient = (ing: Ingredient, base: number, target: number) =>
  displayIngredient(ing, base, target, 'cooking')

describe('checklist ingredient line', () => {
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

  it('uses Spanish unit labels (clove → diente, tbsp → cda)', () => {
    expect(formatIngredient({ name: 'ajo', quantity: 2, unit: 'clove' }, 2, 2)).toBe('2 diente ajo')
    expect(formatIngredient({ name: 'aceite', quantity: 1, unit: 'tbsp' }, 2, 4)).toBe(
      '2 cda aceite',
    )
  })
})
