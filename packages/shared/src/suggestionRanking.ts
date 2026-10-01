import type { Nutrition } from './schema.js'
import type { MacroTotals } from './dayNutrition.js'

/**
 * Ranking for "what can I cook with what I have". Order, most important first:
 * 1. ingredient coverage (fraction of ingredients on hand);
 * 2. uses up pantry items about to expire;
 * 3. not cooked in the last few days (variety);
 * 4. calories closest to the day's remaining goal;
 * 5. the user's average rating for the recipe.
 * Deterministic; the app/agent presents the result.
 */

export interface SuggestionRecipe {
  id: string
  title: string
  /** Each ingredient's display name and canonical key. */
  ingredients: { name: string; key: string }[]
  /** Per-serving nutrition, or null when the recipe has none. */
  nutrition: Nutrition | null
  /** The user's average cook rating (1–5), when rated. */
  avgRating?: number | null
  /** Whether it was cooked within the recency window (see SuggestionContext). */
  recentlyCooked?: boolean
}

export interface SuggestionContext {
  /** Canonical keys of pantry items expiring soon: recipes using them rank up. */
  expiringKeys?: ReadonlySet<string>
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
  /** Per-serving nutrition passed through for the card's macro strip. */
  nutrition: Nutrition | null
  /** Ingredients it would use up that expire soon. */
  usesExpiring: string[]
  recentlyCooked: boolean
  avgRating: number | null
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
  context: SuggestionContext = {},
): SuggestionResult[] {
  const expiring = context.expiringKeys ?? new Set<string>()
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
        nutrition: r.nutrition,
        usesExpiring: r.ingredients.filter((i) => expiring.has(i.key)).map((i) => i.name),
        recentlyCooked: r.recentlyCooked ?? false,
        avgRating: r.avgRating ?? null,
        _distance: distance,
      }
    })
    .sort(
      (a, b) =>
        b.matchFraction - a.matchFraction ||
        b.usesExpiring.length - a.usesExpiring.length ||
        Number(a.recentlyCooked) - Number(b.recentlyCooked) ||
        (a._distance ?? Infinity) - (b._distance ?? Infinity) ||
        (b.avgRating ?? 0) - (a.avgRating ?? 0) ||
        a.title.localeCompare(b.title),
    )
    .map(({ _distance, ...rest }) => {
      void _distance
      return rest
    })
}
