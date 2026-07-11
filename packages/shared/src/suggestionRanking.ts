import type { Nutrition } from './schema.js'
import type { MacroTotals } from './dayNutrition.js'

/**
 * Ranking for "what can I cook with what I have": recipes are ordered first by
 * ingredient coverage (fraction of ingredients on hand), then — as a tiebreak —
 * by how close each recipe's calories bring you to the day's remaining goal.
 * Deterministic; the app/agent presents the result.
 */

export interface SuggestionRecipe {
  id: string
  title: string
  /** Each ingredient's display name and canonical key. */
  ingredients: { name: string; key: string }[]
  /** Per-serving nutrition, or null when the recipe has none. */
  nutrition: Nutrition | null
}

export type GoalFit = 'dentro' | 'cerca' | 'lejos'

export interface SuggestionResult {
  id: string
  title: string
  matchedCount: number
  totalCount: number
  matchFraction: number
  missingIngredients: string[]
  /** How well the recipe fits the remaining daily goal; null without goal/nutrition. */
  goalFit: GoalFit | null
}

/** Relative distance of the recipe's calories from the remaining calories. */
function calorieDistance(recipeCalories: number, remainingCalories: number): number {
  const denom = remainingCalories > 0 ? remainingCalories : recipeCalories > 0 ? recipeCalories : 1
  return Math.abs(recipeCalories - remainingCalories) / denom
}

function fitFromDistance(d: number): GoalFit {
  if (d <= 0.2) return 'dentro'
  if (d <= 0.5) return 'cerca'
  return 'lejos'
}

/**
 * @param recipes   candidate recipes (ingredients pre-resolved to canonical keys)
 * @param haveKeys  canonical keys the user has (ad-hoc list or in-stock pantry)
 * @param remaining the day's remaining macro target, or null for no goal context
 */
export function rankSuggestions(
  recipes: SuggestionRecipe[],
  haveKeys: ReadonlySet<string>,
  remaining: MacroTotals | null,
): SuggestionResult[] {
  return recipes
    .map((r) => {
      const missing = r.ingredients.filter((i) => !haveKeys.has(i.key))
      const totalCount = r.ingredients.length
      const matchedCount = totalCount - missing.length
      const hasGoal = remaining !== null && r.nutrition !== null
      const distance = hasGoal ? calorieDistance(r.nutrition!.calories, remaining!.calories) : null
      return {
        id: r.id,
        title: r.title,
        matchedCount,
        totalCount,
        matchFraction: totalCount > 0 ? matchedCount / totalCount : 0,
        missingIngredients: missing.map((i) => i.name),
        goalFit: distance === null ? null : fitFromDistance(distance),
        _distance: distance,
      }
    })
    .sort(
      (a, b) =>
        b.matchFraction - a.matchFraction ||
        (a._distance ?? Infinity) - (b._distance ?? Infinity) ||
        a.title.localeCompare(b.title),
    )
    .map(({ _distance, ...rest }) => {
      void _distance
      return rest
    })
}
