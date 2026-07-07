import type { Nutrition } from '@recetario/shared'

export interface RoundedNutrition {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
}

// Nutrition values are stored per serving — never scale them by batch size.
export function roundNutrition(nutrition: Nutrition): RoundedNutrition {
  return {
    calories: Math.round(nutrition.calories),
    protein_g: Math.round(nutrition.protein_g * 10) / 10,
    carbs_g: Math.round(nutrition.carbs_g * 10) / 10,
    fat_g: Math.round(nutrition.fat_g * 10) / 10,
    fiber_g: nutrition.fiber_g != null ? Math.round(nutrition.fiber_g * 10) / 10 : undefined,
  }
}
