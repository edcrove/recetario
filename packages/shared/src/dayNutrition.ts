import type { Nutrition } from './schema.js'
import type { NutritionTargets } from './schema.js'

/** One planned menu entry contributing to a day's nutrition. */
export interface DayNutritionEntry {
  /** Meal category slug (e.g. 'almuerzo'), for the per-meal breakdown. */
  mealCategory?: string
  /** Per-serving nutrition of the recipe; null when the recipe has no data. */
  nutrition: Nutrition | null
  /** Number of servings planned for this entry. */
  servings: number
}

export interface MacroTotals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

/** Signed difference consumed − target, per macro. null when no target set. */
export interface MacroDelta {
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}

export interface MealBreakdown {
  mealCategory: string
  totals: MacroTotals
}

export interface DayNutrition {
  totals: MacroTotals
  /** The applicable daily target (the four daily_* fields), or null if unset. */
  target: MacroTotals | null
  /** Signed delta vs the daily target, or null when there is no target. */
  delta: MacroDelta | null
  /** Per-meal totals, present only for meals that have entries. */
  byMeal: MealBreakdown[]
  /** True when at least one planned recipe was excluded for lacking nutrition. */
  partial: boolean
  /** How many entries were excluded because their recipe has no nutrition. */
  missingCount: number
}

const ZERO: MacroTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function addScaled(acc: MacroTotals, n: Nutrition, servings: number): MacroTotals {
  return {
    calories: acc.calories + n.calories * servings,
    protein_g: acc.protein_g + n.protein_g * servings,
    carbs_g: acc.carbs_g + n.carbs_g * servings,
    fat_g: acc.fat_g + n.fat_g * servings,
  }
}

function roundTotals(t: MacroTotals): MacroTotals {
  return {
    calories: Math.round(t.calories),
    protein_g: round1(t.protein_g),
    carbs_g: round1(t.carbs_g),
    fat_g: round1(t.fat_g),
  }
}

/**
 * Rolls up a day's planned menu into macro totals and, when a daily target is
 * set, a signed delta (positive = over the target, negative = under). Recipes
 * without nutrition data are excluded and flagged via `partial`/`missingCount`
 * — never guessed. Pure and deterministic.
 */
export function computeDayNutrition(
  entries: DayNutritionEntry[],
  target: NutritionTargets | null,
): DayNutrition {
  let totals = { ...ZERO }
  const mealAcc = new Map<string, MacroTotals>()
  let missingCount = 0

  for (const entry of entries) {
    if (!entry.nutrition) {
      missingCount++
      continue
    }
    totals = addScaled(totals, entry.nutrition, entry.servings)
    if (entry.mealCategory) {
      const prev = mealAcc.get(entry.mealCategory) ?? { ...ZERO }
      mealAcc.set(entry.mealCategory, addScaled(prev, entry.nutrition, entry.servings))
    }
  }

  totals = roundTotals(totals)

  const dailyTarget: MacroTotals | null = target
    ? {
        calories: target.daily_calories,
        protein_g: target.daily_protein_g,
        carbs_g: target.daily_carbs_g,
        fat_g: target.daily_fat_g,
      }
    : null

  const delta: MacroDelta | null = dailyTarget
    ? {
        calories: dailyTarget.calories > 0 ? totals.calories - dailyTarget.calories : null,
        protein_g:
          dailyTarget.protein_g > 0 ? round1(totals.protein_g - dailyTarget.protein_g) : null,
        carbs_g: dailyTarget.carbs_g > 0 ? round1(totals.carbs_g - dailyTarget.carbs_g) : null,
        fat_g: dailyTarget.fat_g > 0 ? round1(totals.fat_g - dailyTarget.fat_g) : null,
      }
    : null

  const byMeal: MealBreakdown[] = [...mealAcc.entries()].map(([mealCategory, t]) => ({
    mealCategory,
    totals: roundTotals(t),
  }))

  return {
    totals,
    target: dailyTarget,
    delta,
    byMeal,
    partial: missingCount > 0,
    missingCount,
  }
}
