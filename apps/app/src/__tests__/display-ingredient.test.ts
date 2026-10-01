import { describe, it, expect } from 'vitest'
import {
  formatQuantity,
  formatCount,
  displayIngredient,
  unitLabel,
} from '../utils/displayIngredient'
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

  it('imperial mode: picks cups for larger volumes (never 100 cdta leche)', () => {
    const ing: Ingredient = { name: 'Leche', quantity: 500, unit: 'ml' }
    expect(displayIngredient(ing, 1, 1, 'imperial')).toBe('2.08 taza Leche')
  })

  it('imperial mode: tablespoons for medium amounts', () => {
    const ing: Ingredient = { name: 'Aceite', quantity: 30, unit: 'ml' }
    expect(displayIngredient(ing, 1, 1, 'imperial')).toBe('2 cda Aceite')
  })

  it('metric mode: liters from 1000 ml', () => {
    const ing: Ingredient = { name: 'Caldo', quantity: 6, unit: 'cup' }
    expect(displayIngredient(ing, 1, 1, 'metric')).toBe('1.44 l Caldo')
  })

  it('metric mode: count units stay as written', () => {
    const ing: Ingredient = { name: 'Huevo', quantity: 2, unit: 'unit' }
    expect(displayIngredient(ing, 1, 1, 'metric')).toBe('2 u Huevo')
  })

  it('scaled counts snap to halves and read as fractions (never 1.33 u huevos)', () => {
    const eggs: Ingredient = { name: 'Huevos', quantity: 2, unit: 'unit' }
    expect(displayIngredient(eggs, 3, 2, 'cooking')).toBe('1½ u Huevos')
    const garlic: Ingredient = { name: 'Ajo', quantity: 1, unit: 'clove' }
    expect(displayIngredient(garlic, 4, 1, 'cooking')).toBe('½ diente Ajo')
    const lemons: Ingredient = { name: 'Limones', quantity: 3, unit: null }
    expect(displayIngredient(lemons, 2, 3, 'cooking')).toBe('4½ Limones')
  })
})

describe('formatCount', () => {
  it('uses ½ for halves and falls back otherwise', () => {
    expect(formatCount(0.5)).toBe('½')
    expect(formatCount(2.5)).toBe('2½')
    expect(formatCount(3)).toBe('3')
  })
})
