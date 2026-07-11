import { normalizeIngredientKey } from './ingredientCanonical.js'

/**
 * Small curated allergen alias set (es). The full canonical/synonym table lives
 * in the DB, but the allergen check runs client-side with no DB access, so the
 * handful of allergen aliases that matter for safety are kept here — pure and
 * shippable to the app. "maní ≡ cacahuate" is the spec's example.
 */
export const ALLERGEN_ALIASES: Record<string, string[]> = {
  mani: ['mani', 'cacahuate', 'cacahuete'],
  nuez: ['nuez', 'nogal'],
  leche: ['leche', 'lacteo'],
}

/**
 * True when an ingredient name contains the given allergen. Both sides are run
 * through normalizeIngredientKey (case/accents/plurals/presentations), and the
 * allergen expands to its aliases — so a recipe listing "Cacahuate tostado"
 * still trips a "maní" allergy.
 */
export function ingredientHasAllergen(ingredientName: string, allergen: string): boolean {
  const ing = normalizeIngredientKey(ingredientName)
  const key = normalizeIngredientKey(allergen)
  if (!key || !ing) return false
  const aliases = ALLERGEN_ALIASES[key] ?? [key]
  return aliases.some((a) => ing.includes(a))
}
