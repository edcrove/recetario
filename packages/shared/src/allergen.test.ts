import { describe, it, expect } from 'vitest'
import { ingredientHasAllergen, ALLERGEN_ALIASES } from './allergen.js'

describe('ingredientHasAllergen', () => {
  it('matches on the same word regardless of case/accents/plurals/presentation', () => {
    expect(ingredientHasAllergen('Maníes tostados', 'maní')).toBe(true)
    expect(ingredientHasAllergen('LECHE entera', 'leche')).toBe(true)
    expect(ingredientHasAllergen('Nueces picadas', 'nuez')).toBe(true)
  })

  it('resolves allergen aliases (cacahuate ≡ maní)', () => {
    expect(ingredientHasAllergen('Cacahuate', 'maní')).toBe(true)
    expect(ingredientHasAllergen('Manteca de cacahuete', 'mani')).toBe(true)
  })

  it('matches an allergen with no alias entry by its own normalized key', () => {
    expect(ingredientHasAllergen('Harina de trigo', 'trigo')).toBe(true)
    expect(ingredientHasAllergen('Salsa de soja', 'soja')).toBe(true)
  })

  it('does not match unrelated ingredients', () => {
    expect(ingredientHasAllergen('Manzana', 'maní')).toBe(false)
    expect(ingredientHasAllergen('Tomate', 'leche')).toBe(false)
  })

  it('returns false for empty inputs', () => {
    expect(ingredientHasAllergen('', 'maní')).toBe(false)
    expect(ingredientHasAllergen('Maní', '')).toBe(false)
  })

  it('exposes the alias table', () => {
    expect(ALLERGEN_ALIASES['mani']).toContain('cacahuate')
  })
})
