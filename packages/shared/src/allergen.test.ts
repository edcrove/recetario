import { describe, it, expect } from 'vitest'
import {
  ingredientHasAllergen,
  toAllergenKey,
  allergenLabel,
  normalizeAllergens,
  ALLERGENS,
  ALLERGEN_LABELS,
  AllergenSchema,
} from './allergen.js'

const has = (ingredient: string, allergen: string) => ingredientHasAllergen(ingredient, allergen)

describe('allergen enum', () => {
  it('lists the 14 major allergens, each with a Spanish label', () => {
    expect(ALLERGENS).toHaveLength(14)
    for (const a of ALLERGENS) expect(ALLERGEN_LABELS[a]).toBeTruthy()
    expect(AllergenSchema.safeParse('leche').success).toBe(true)
    expect(AllergenSchema.safeParse('maní').success).toBe(false)
  })
})

describe('toAllergenKey / allergenLabel', () => {
  it('accepts keys, labels and common Spanish names', () => {
    expect(toAllergenKey('frutos_secos')).toBe('frutos_secos')
    expect(toAllergenKey('Maní')).toBe('mani')
    expect(toAllergenKey('Lácteos')).toBe('leche')
    expect(toAllergenKey('nueces')).toBe('frutos_secos')
    expect(toAllergenKey('Frutos secos')).toBe('frutos_secos')
    expect(toAllergenKey('mariscos')).toBe('crustaceos')
    expect(toAllergenKey('TACC')).toBe('gluten')
    expect(toAllergenKey('Gluten (TACC)')).toBe('gluten')
    expect(toAllergenKey('kiwi')).toBeNull()
  })

  it('labels known allergens and passes unknown text through', () => {
    expect(allergenLabel('mani')).toBe('Maní')
    expect(allergenLabel('nuez')).toBe('Frutos secos')
    expect(allergenLabel('kiwi')).toBe('kiwi')
  })
})

describe('normalizeAllergens', () => {
  it('maps known names to keys, keeps unknown text and dedupes', () => {
    expect(normalizeAllergens(['maní', 'mani', 'Lácteos', 'kiwi'])).toEqual([
      'mani',
      'leche',
      'kiwi',
    ])
  })
})

describe('ingredientHasAllergen', () => {
  it('leche: manteca, queso, yogur, dulce de leche, crema', () => {
    for (const i of [
      'Manteca',
      'Queso rallado',
      'Yogur natural',
      'Dulce de leche',
      'Crema de leche',
    ])
      expect(has(i, 'leche')).toBe(true)
  })

  it('gluten: harina de trigo, pan rallado, fideos, ñoquis', () => {
    for (const i of ['Harina de trigo 0000', 'Pan rallado', 'Fideos secos', 'Ñoquis', 'Avena'])
      expect(has(i, 'gluten')).toBe(true)
  })

  it('huevo: mayonesa and yemas', () => {
    expect(has('Mayonesa', 'huevo')).toBe(true)
    expect(has('Yemas', 'huevo')).toBe(true)
  })

  it('mariscos: langostinos, calamares', () => {
    expect(has('Langostinos', 'crustaceos')).toBe(true)
    expect(has('Calamares', 'moluscos')).toBe(true)
    expect(has('Langostinos', 'mariscos')).toBe(true)
  })

  it('cuts out false friends before matching', () => {
    expect(has('Nuez moscada', 'frutos_secos')).toBe(false)
    expect(has('Nueces picadas', 'frutos_secos')).toBe(true)
    expect(has('Leche de coco', 'leche')).toBe(false)
    expect(has('Manteca de maní', 'leche')).toBe(false)
    expect(has('Manteca de maní', 'mani')).toBe(true)
    expect(has('Harina de maíz', 'gluten')).toBe(false)
    expect(has('Pasta de tomate', 'gluten')).toBe(false)
  })

  it('matches whole words only (panceta is not pan)', () => {
    expect(has('Panceta ahumada', 'gluten')).toBe(false)
    expect(has('Manzana', 'mani')).toBe(false)
    expect(has('Tomate', 'leche')).toBe(false)
  })

  it('keeps matching legacy free-text allergens (key, alias and unknown)', () => {
    expect(has('Maníes tostados', 'maní')).toBe(true)
    expect(has('Cacahuate', 'maní')).toBe(true)
    expect(has('Nueces', 'nuez')).toBe(true)
    expect(has('Kiwi en rodajas', 'kiwi')).toBe(true)
    expect(has('Banana', 'kiwi')).toBe(false)
  })

  it('returns false for empty inputs', () => {
    expect(has('', 'mani')).toBe(false)
    expect(has('Maní', '')).toBe(false)
  })
})
