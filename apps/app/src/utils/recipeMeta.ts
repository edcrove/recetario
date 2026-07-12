import type { Recipe, RecipeDifficulty } from '@recetario/shared'

/** The three difficulty levels, in ascending order (matches the API enum). */
export const DIFFICULTIES: RecipeDifficulty[] = ['fácil', 'media', 'difícil']

export interface TimeFilterOption {
  label: string
  maxTotalTime: number
}

/** Max-time filter chips shown in home + pick screens. */
export const TIME_FILTERS: TimeFilterOption[] = [
  { label: '≤ 20 min', maxTotalTime: 20 },
  { label: '≤ 40 min', maxTotalTime: 40 },
  { label: '≤ 60 min', maxTotalTime: 60 },
]

type RecipeMeta = Pick<Recipe, 'totalTimeMin' | 'difficulty'>

/**
 * Compact card line, e.g. "⏱ 25 min · fácil". Shows whichever fields exist and
 * returns '' when both are absent, so the card can hide the line cleanly.
 */
export function formatTimeDifficulty(recipe: RecipeMeta): string {
  const parts: string[] = []
  if (recipe.totalTimeMin != null) parts.push(`⏱ ${recipe.totalTimeMin} min`)
  if (recipe.difficulty) parts.push(recipe.difficulty)
  return parts.join(' · ')
}

export interface RecipeMetaFilter {
  maxTotalTime?: number
  difficulty?: RecipeDifficulty
}

/**
 * Client-side predicate for the time/difficulty chips. Mirrors the API's
 * semantics: a recipe with an unknown total time can't be confirmed under the
 * cap, so it's excluded when a max-time filter is active.
 */
export function matchesTimeDifficulty(recipe: RecipeMeta, filter: RecipeMetaFilter): boolean {
  if (filter.maxTotalTime != null) {
    if (recipe.totalTimeMin == null || recipe.totalTimeMin > filter.maxTotalTime) return false
  }
  if (filter.difficulty != null && recipe.difficulty !== filter.difficulty) return false
  return true
}

/** Applies {@link matchesTimeDifficulty} across a list. Identity when no filter set. */
export function filterByTimeDifficulty<T extends RecipeMeta>(
  recipes: T[],
  filter: RecipeMetaFilter,
): T[] {
  if (filter.maxTotalTime == null && filter.difficulty == null) return recipes
  return recipes.filter((r) => matchesTimeDifficulty(r, filter))
}
