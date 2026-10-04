import { DEFAULT_NUTRITION_TARGETS, type NutritionTargets } from '@recetario/shared'

export type DailyTargetField =
  'daily_calories' | 'daily_protein_g' | 'daily_carbs_g' | 'daily_fat_g'

// Same bounds as NutritionTargetsSchema, so the stepper never sends a 400.
export const TARGET_MAX: Record<DailyTargetField, number> = {
  daily_calories: 10000,
  daily_protein_g: 600,
  daily_carbs_g: 1500,
  daily_fat_g: 600,
}

/** The saved targets, or the displayed defaults when none were saved yet. */
function base(targets: NutritionTargets | null | undefined): NutritionTargets {
  return { ...DEFAULT_NUTRITION_TARGETS, ...(targets ?? {}) }
}

/**
 * Steps one daily target and keeps every other field — in particular the
 * per-meal goals, which the API stores in the same object and replaces whole.
 */
export function withDailyTarget(
  targets: NutritionTargets | null | undefined,
  field: DailyTargetField,
  delta: number,
): NutritionTargets {
  const t = base(targets)
  return { ...t, [field]: Math.min(TARGET_MAX[field], Math.max(0, t[field] + delta)) }
}

/** Steps one meal's calorie goal and keeps the daily targets and other meals. */
export function withMealCalories(
  targets: NutritionTargets | null | undefined,
  slot: string,
  delta: number,
): NutritionTargets {
  const t = base(targets)
  const perMeal = { ...(t.per_meal ?? {}) }
  const current = perMeal[slot]?.calories ?? 0
  perMeal[slot] = { ...perMeal[slot], calories: Math.max(0, current + delta) }
  return { ...t, per_meal: perMeal }
}
