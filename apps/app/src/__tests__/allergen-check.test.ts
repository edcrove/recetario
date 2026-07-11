import { describe, it, expect } from 'vitest'
import { checkAllergens, DIETARY_LABELS } from '../utils/allergenCheck'
import type { Recipe } from '@recetario/shared'

function recipe(overrides: Partial<Pick<Recipe, 'ingredients' | 'dietaryTags'>> = {}) {
  return {
    ingredients: [{ name: 'Leche', quantity: 1, unit: 'cup' as const, presentation: undefined }],
    dietaryTags: [],
    ...overrides,
  }
}

describe('checkAllergens', () => {
  it('returns empty result when profile is undefined', () => {
    expect(checkAllergens(recipe(), undefined)).toEqual({
      matchedAllergens: [],
      unmetDietary: [],
    })
  })

  it('returns empty result when nothing conflicts', () => {
    const result = checkAllergens(
      recipe({ ingredients: [{ name: 'Arroz', quantity: 1, unit: null }] }),
      {
        allergens: ['maní'],
        dietaryRestrictions: [],
      },
    )
    expect(result).toEqual({ matchedAllergens: [], unmetDietary: [] })
  })

  it('matches an allergen present in an ingredient name (case-insensitive)', () => {
    const result = checkAllergens(
      recipe({ ingredients: [{ name: 'Leche entera', quantity: 1, unit: null }] }),
      {
        allergens: ['LECHE'],
      },
    )
    expect(result.matchedAllergens).toEqual(['LECHE'])
  })

  it('matches a regional synonym of the allergen (cacahuate ≡ maní)', () => {
    const result = checkAllergens(
      recipe({ ingredients: [{ name: 'Cacahuate tostado', quantity: 50, unit: 'g' }] }),
      { allergens: ['maní'] },
    )
    expect(result.matchedAllergens).toEqual(['maní'])
  })

  it('flags a dietary restriction not covered by the recipe tags', () => {
    const result = checkAllergens(recipe({ dietaryTags: [] }), {
      dietaryRestrictions: ['vegano'],
    })
    expect(result.unmetDietary).toEqual(['vegano'])
  })

  it('does not flag a dietary restriction the recipe does satisfy', () => {
    const result = checkAllergens(recipe({ dietaryTags: ['vegano'] }), {
      dietaryRestrictions: ['vegano'],
    })
    expect(result.unmetDietary).toEqual([])
  })

  it('handles a profile with no allergens/dietaryRestrictions fields at all', () => {
    expect(checkAllergens(recipe(), {})).toEqual({ matchedAllergens: [], unmetDietary: [] })
  })

  it('treats a recipe with no dietaryTags field as satisfying nothing', () => {
    const noTagsRecipe = { ingredients: recipe().ingredients }
    const result = checkAllergens(noTagsRecipe, { dietaryRestrictions: ['keto'] })
    expect(result.unmetDietary).toEqual(['keto'])
  })
})

describe('DIETARY_LABELS', () => {
  it('has a friendly Spanish label for every DIETARY_TAGS value', () => {
    expect(DIETARY_LABELS['sin-lactosa']).toBe('Sin lactosa')
    expect(DIETARY_LABELS['vegano']).toBe('Vegano')
  })
})
