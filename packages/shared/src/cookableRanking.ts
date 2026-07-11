/**
 * Deterministic "what can I cook" ranking: given recipes (with each ingredient
 * already resolved to a canonical key) and the set of in-stock pantry keys,
 * rank recipes by the fraction of ingredients on hand and list what's missing.
 * No inference — the agent/app presents the result.
 */

export interface RankInputRecipe {
  id: string
  title: string
  /** Each ingredient's display name and its canonical/normalized key. */
  ingredients: { name: string; key: string }[]
}

export interface CookableResult {
  id: string
  title: string
  matchedCount: number
  totalCount: number
  /** matchedCount / totalCount, 0 when the recipe has no ingredients. */
  matchFraction: number
  /** Display names of the ingredients not covered by the pantry. */
  missingIngredients: string[]
}

/** Ranks recipes by pantry coverage (most cookable first, then title). */
export function rankCookable(
  recipes: RankInputRecipe[],
  pantryKeys: ReadonlySet<string>,
): CookableResult[] {
  return recipes
    .map((r): CookableResult => {
      const missing = r.ingredients.filter((i) => !pantryKeys.has(i.key))
      const totalCount = r.ingredients.length
      const matchedCount = totalCount - missing.length
      return {
        id: r.id,
        title: r.title,
        matchedCount,
        totalCount,
        matchFraction: totalCount > 0 ? matchedCount / totalCount : 0,
        missingIngredients: missing.map((i) => i.name),
      }
    })
    .sort((a, b) => b.matchFraction - a.matchFraction || a.title.localeCompare(b.title))
}
