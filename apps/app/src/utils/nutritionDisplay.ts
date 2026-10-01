import type { Nutrition } from '@recetario/shared'

export interface RoundedNutrition {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  sugars_g?: number
  saturated_fat_g?: number
  sodium_mg?: number
}

// Nutrition values are stored per serving — never scale this by batch size.
export function roundNutrition(nutrition: Nutrition): RoundedNutrition {
  return {
    calories: Math.round(nutrition.calories),
    protein_g: Math.round(nutrition.protein_g * 10) / 10,
    carbs_g: Math.round(nutrition.carbs_g * 10) / 10,
    fat_g: Math.round(nutrition.fat_g * 10) / 10,
    fiber_g: nutrition.fiber_g != null ? Math.round(nutrition.fiber_g * 10) / 10 : undefined,
    sugars_g: nutrition.sugars_g != null ? Math.round(nutrition.sugars_g * 10) / 10 : undefined,
    saturated_fat_g:
      nutrition.saturated_fat_g != null
        ? Math.round(nutrition.saturated_fat_g * 10) / 10
        : undefined,
    sodium_mg: nutrition.sodium_mg != null ? Math.round(nutrition.sodium_mg) : undefined,
  }
}

// Multiplies the per-serving nutrition facts by the currently selected number
// of servings, so the UI can show a running total alongside the fixed
// per-serving figure (see recipe/[id].tsx's servings stepper).
export function scaleNutrition(nutrition: Nutrition, servings: number): Nutrition {
  return {
    calories: nutrition.calories * servings,
    protein_g: nutrition.protein_g * servings,
    carbs_g: nutrition.carbs_g * servings,
    fat_g: nutrition.fat_g * servings,
    fiber_g: nutrition.fiber_g != null ? nutrition.fiber_g * servings : undefined,
    sugars_g: nutrition.sugars_g != null ? nutrition.sugars_g * servings : undefined,
    saturated_fat_g:
      nutrition.saturated_fat_g != null ? nutrition.saturated_fat_g * servings : undefined,
    sodium_mg: nutrition.sodium_mg != null ? nutrition.sodium_mg * servings : undefined,
  }
}

/** "Azúcares 12 g · Grasas sat. 3.5 g · Sodio 480 mg" — only the nutrients that are known. */
export function extraNutrientsLine(n: {
  sugars_g?: number
  saturated_fat_g?: number
  sodium_mg?: number
}): string {
  return [
    n.sugars_g != null ? `Azúcares ${n.sugars_g} g` : null,
    n.saturated_fat_g != null ? `Grasas sat. ${n.saturated_fat_g} g` : null,
    n.sodium_mg != null ? `Sodio ${Math.round(n.sodium_mg)} mg` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
