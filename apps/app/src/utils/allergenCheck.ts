import type { Recipe } from '@recetario/shared'
import {
  DIETARY_LABELS as SHARED_DIETARY_LABELS,
  dietaryStatus,
  ingredientHasAllergen,
} from '@recetario/shared'

export const DIETARY_LABELS: Record<string, string> = SHARED_DIETARY_LABELS

export interface DietaryProfile {
  allergens?: string[]
  dietaryRestrictions?: string[]
}

export interface AllergenCheckResult {
  matchedAllergens: string[]
  /** Diets an ingredient contradicts. */
  unmetDietary: string[]
  /** Diets the recipe isn't tagged with but nothing contradicts — unknown, not a violation. */
  unverifiedDietary: string[]
}

const EMPTY_RESULT: AllergenCheckResult = {
  matchedAllergens: [],
  unmetDietary: [],
  unverifiedDietary: [],
}

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

  // Both sides are normalized (case/accents/plurals/presentation) and the
  // allergen expands to its aliases, so "Cacahuate" trips a "maní" allergy.
  const matchedAllergens = userAllergens.filter((allergen) =>
    recipe.ingredients.some((i) => ingredientHasAllergen(i.name, allergen)),
  )

  const status = (d: string) => dietaryStatus(recipe, d)
  const unmetDietary = userDietary.filter((d) => status(d) === 'no-cumple')
  const unverifiedDietary = userDietary.filter((d) => status(d) === 'sin-verificar')

  return { matchedAllergens, unmetDietary, unverifiedDietary }
}
