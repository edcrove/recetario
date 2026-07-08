import type { Nutrition } from '@recetario/shared'

export interface RoundedNutrition {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
}

// Nutrition values are stored per serving — never scale this by batch size.
export function roundNutrition(nutrition: Nutrition): RoundedNutrition {
  return {
    calories: Math.round(nutrition.calories),
    protein_g: Math.round(nutrition.protein_g * 10) / 10,
    carbs_g: Math.round(nutrition.carbs_g * 10) / 10,
    fat_g: Math.round(nutrition.fat_g * 10) / 10,
    fiber_g: nutrition.fiber_g != null ? Math.round(nutrition.fiber_g * 10) / 10 : undefined,
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
  }
}
