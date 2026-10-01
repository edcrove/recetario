import { describe, it, expect } from 'vitest'
import { dietaryConflicts, dietaryStatus, expandDietaryTags } from './dietary.js'

const ing = (...names: string[]) => names.map((name) => ({ name }))

describe('expandDietaryTags', () => {
  it('adds what a diet implies', () => {
    expect([...expandDietaryTags(['vegano'])].sort()).toEqual([
      'sin-lactosa',
      'vegano',
      'vegetariano',
    ])
    expect([...expandDietaryTags(['keto'])]).toEqual(['keto'])
  })
})

describe('dietaryConflicts', () => {
  it('flags a vegano recipe with chorizo (the seed bug)', () => {
    expect(dietaryConflicts(ing('Lentejas', 'Chorizo colorado'), ['vegano', 'sin-gluten'])).toEqual(
      [{ tag: 'vegano', ingredient: 'Chorizo colorado' }],
    )
  })

  it('vegetariano rejects meat and seafood but not dairy or eggs', () => {
    expect(dietaryConflicts(ing('Pechuga de pollo'), ['vegetariano'])).toHaveLength(1)
    expect(dietaryConflicts(ing('Langostinos'), ['vegetariano'])).toHaveLength(1)
    expect(dietaryConflicts(ing('Merluza'), ['vegetariano'])).toHaveLength(1)
    expect(dietaryConflicts(ing('Queso', 'Huevos'), ['vegetariano'])).toEqual([])
  })

  it('vegano also rejects dairy, eggs and honey', () => {
    expect(dietaryConflicts(ing('Manteca', 'Huevo', 'Miel'), ['vegano'])).toHaveLength(3)
  })

  it('sin-gluten and sin-lactosa use the allergen derivatives', () => {
    expect(dietaryConflicts(ing('Fideos'), ['sin-gluten'])).toHaveLength(1)
    expect(dietaryConflicts(ing('Dulce de leche'), ['sin-lactosa'])).toHaveLength(1)
    expect(dietaryConflicts(ing('Leche de coco'), ['sin-lactosa'])).toEqual([])
  })

  it('skips plant-based look-alikes and undecidable diets', () => {
    expect(dietaryConflicts(ing('Carne de soja', 'Hamburguesa de lentejas'), ['vegano'])).toEqual(
      [],
    )
    expect(dietaryConflicts(ing('Panceta'), ['keto', 'paleo'])).toEqual([])
  })
})

describe('dietaryStatus', () => {
  it('cumple when tagged, directly or by implication', () => {
    const r = { ingredients: ing('Lentejas'), dietaryTags: ['vegano'] }
    expect(dietaryStatus(r, 'vegano')).toBe('cumple')
    expect(dietaryStatus(r, 'vegetariano')).toBe('cumple')
  })

  it('sin-verificar when untagged and nothing contradicts it', () => {
    expect(dietaryStatus({ ingredients: ing('Arroz') }, 'vegano')).toBe('sin-verificar')
    expect(dietaryStatus({ ingredients: ing('Arroz'), dietaryTags: null }, 'keto')).toBe(
      'sin-verificar',
    )
  })

  it('no-cumple when an ingredient contradicts it, even if tagged', () => {
    expect(dietaryStatus({ ingredients: ing('Chorizo'), dietaryTags: ['vegano'] }, 'vegano')).toBe(
      'no-cumple',
    )
  })
})
