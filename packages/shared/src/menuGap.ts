/**
 * Per-meal gap analysis: given each planned meal's ingredients (already resolved
 * to canonical keys) and the in-stock pantry keys, decide which meals are fully
 * cookable now and list what's missing for the rest. Matching is by canonical
 * name; anything not clearly on hand is treated as missing (conservative).
 */

export interface PlannedMeal {
  date: string
  slot: string
  recipeId: string | null
  recipeName?: string
  ingredients: { name: string; key: string }[]
}

export interface MealGap {
  date: string
  slot: string
  recipeId: string | null
  recipeName?: string
  /** True only when every ingredient is on hand (and the meal has ingredients). */
  cookable: boolean
  /** Display names of the ingredients not covered by the pantry (de-duplicated). */
  missingIngredients: string[]
}

export function computeMenuGaps(meals: PlannedMeal[], pantryKeys: ReadonlySet<string>): MealGap[] {
  return meals.map((meal) => {
    const missing: string[] = []
    const seen = new Set<string>()
    for (const ing of meal.ingredients) {
      if (pantryKeys.has(ing.key)) continue
      if (seen.has(ing.key)) continue
      seen.add(ing.key)
      missing.push(ing.name)
    }
    return {
      date: meal.date,
      slot: meal.slot,
      recipeId: meal.recipeId,
      recipeName: meal.recipeName,
      cookable: meal.ingredients.length > 0 && missing.length === 0,
      missingIngredients: missing,
    }
  })
}
