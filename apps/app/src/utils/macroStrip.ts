import type { Nutrition } from '@recetario/shared'

/**
 * A compact per-serving macro line for recipe cards ('420 kcal · 28P · 52C · 12G'),
 * the at-a-glance decision data when building a menu. Returns null when the
 * recipe has no nutrition, so callers render nothing instead of empty zeros.
 */
export function macroStrip(nutrition: Nutrition | null | undefined): string | null {
  if (!nutrition) return null
  const r = (n: number) => Math.round(n)
  return `${r(nutrition.calories)} kcal · ${r(nutrition.protein_g)}P · ${r(nutrition.carbs_g)}C · ${r(nutrition.fat_g)}G`
}
