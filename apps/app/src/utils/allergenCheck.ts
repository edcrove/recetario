import type { Recipe } from '@recetario/shared'
import { ingredientHasAllergen } from '@recetario/shared'

export const DIETARY_LABELS: Record<string, string> = {
  vegano: 'Vegano',
  vegetariano: 'Vegetariano',
  'sin-gluten': 'Sin gluten',
  'sin-lactosa': 'Sin lactosa',
  keto: 'Keto',
  paleo: 'Paleo',
}

export interface DietaryProfile {
  allergens?: string[]
  dietaryRestrictions?: string[]
}

export interface AllergenCheckResult {
  matchedAllergens: string[]
  unmetDietary: string[]
}

const EMPTY_RESULT: AllergenCheckResult = { matchedAllergens: [], unmetDietary: [] }

// Pure so it can be reused by both the full AllergenWarning banner and the
// compact AllergenBadge used in list/picker contexts, without duplicating
// the matching logic or each re-fetching the profile independently.
export function checkAllergens(
  recipe: Pick<Recipe, 'ingredients' | 'dietaryTags'>,
  profile: DietaryProfile | undefined,
): AllergenCheckResult {
  if (!profile) return EMPTY_RESULT

  const userAllergens = profile.allergens ?? []
  const userDietary = profile.dietaryRestrictions ?? []
  const recipeTags = (recipe.dietaryTags ?? []) as string[]

  // Both sides are normalized (case/accents/plurals/presentation) and the
  // allergen expands to its aliases, so "Cacahuate" trips a "maní" allergy.
  const matchedAllergens = userAllergens.filter((allergen) =>
    recipe.ingredients.some((i) => ingredientHasAllergen(i.name, allergen)),
  )

  const unmetDietary = userDietary.filter((d) => !recipeTags.includes(d))

  return { matchedAllergens, unmetDietary }
}
