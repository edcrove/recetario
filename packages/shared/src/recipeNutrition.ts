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
    return scalePerServing(existing.nutrition, existing.servings / update.servings)
  }
  return undefined
}

/**
 * Multiplies per-serving nutrition by `factor`, keeping only the fields that
 * are present and rounding like the rest of the app (kcal and mg to integers,
 * grams to one decimal).
 */
export function scalePerServing(n: Nutrition, factor: number): Nutrition {
  const out: Nutrition = {
    calories: Math.round(n.calories * factor),
    protein_g: round1(n.protein_g * factor),
    carbs_g: round1(n.carbs_g * factor),
    fat_g: round1(n.fat_g * factor),
  }
  for (const key of ['fiber_g', 'sugars_g', 'saturated_fat_g'] as const) {
    const v = n[key]
    if (v !== undefined) out[key] = round1(v * factor)
  }
  if (n.sodium_mg !== undefined) out.sodium_mg = Math.round(n.sodium_mg * factor)
  return out
}
