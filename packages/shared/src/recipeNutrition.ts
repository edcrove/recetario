import type { Ingredient, Nutrition } from './schema.js'

interface NutritionBasis {
  servings: number
  nutrition?: Nutrition | null
  ingredients: Pick<Ingredient, 'name' | 'quantity' | 'unit'>[]
}

interface NutritionUpdate {
  servings?: number
  nutrition?: Nutrition | null
  ingredients?: Pick<Ingredient, 'name' | 'quantity' | 'unit'>[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function sameIngredients(
  a: NutritionBasis['ingredients'],
  b: NonNullable<NutritionUpdate['ingredients']>,
): boolean {
  const key = (i: NutritionBasis['ingredients'][number]) =>
    `${i.name.trim().toLowerCase()}|${i.quantity ?? ''}|${i.unit ?? ''}`
  return a.length === b.length && a.every((ing, idx) => key(ing) === key(b[idx]!))
}

/**
 * What per-serving nutrition a recipe should store after an edit, so it never
 * silently goes stale. Returns undefined to leave it unchanged.
 *
 * - Explicit `nutrition` (an object, or null to clear) always wins.
 * - Different ingredients invalidate it → null ("sin datos") until re-estimated.
 * - Only the servings changed → the same batch split differently, so scale it.
 */
export function nutritionAfterEdit(
  existing: NutritionBasis,
  update: NutritionUpdate,
): Nutrition | null | undefined {
  if (update.nutrition !== undefined) return update.nutrition
  if (!existing.nutrition) return undefined
  if (
    update.ingredients !== undefined &&
    !sameIngredients(existing.ingredients, update.ingredients)
  )
    return null
  if (update.servings !== undefined && update.servings !== existing.servings) {
    const f = existing.servings / update.servings
    const n = existing.nutrition
    return {
      calories: Math.round(n.calories * f),
      protein_g: round1(n.protein_g * f),
      carbs_g: round1(n.carbs_g * f),
      fat_g: round1(n.fat_g * f),
      ...(n.fiber_g !== undefined && { fiber_g: round1(n.fiber_g * f) }),
    }
  }
  return undefined
}
