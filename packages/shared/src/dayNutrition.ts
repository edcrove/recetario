import type { Nutrition } from './schema.js'
import type { MealTarget, NutritionTargets } from './schema.js'

/**
 * One planned menu entry contributing to a day's nutrition. The rollup is
 * per-person intake: each planned dish counts as one portion for the person
 * whose target it is compared against, however many servings the household
 * cooks (decision D-2026-10-01-5).
 */
export interface DayNutritionEntry {
  /** Meal category slug (e.g. 'almuerzo'), for the per-meal breakdown. */
  mealCategory?: string
  /** Per-serving nutrition of the recipe; null when the recipe has no data. */
  nutrition: Nutrition | null
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
  /** The per-meal goal for this slot from the profile, or null if none is set. */
  target: MealTarget | null
  /** Calories consumed − per-meal calorie goal; null without a calorie goal. */
  calorieDelta: number | null
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

function addPortion(acc: MacroTotals, n: Nutrition): MacroTotals {
  return {
    calories: acc.calories + n.calories,
    protein_g: acc.protein_g + n.protein_g,
    carbs_g: acc.carbs_g + n.carbs_g,
    fat_g: acc.fat_g + n.fat_g,
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

function slotKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * The per-meal goal for a menu slot. Keys are menu slots ("Cena"), matched
 * ignoring case and accents so older lowercase slugs ("cena") still apply.
 */
export function mealTargetFor(
  perMeal: Record<string, MealTarget> | undefined,
  slot: string,
): MealTarget | null {
  if (!perMeal) return null
  const key = slotKey(slot)
  const hit = Object.entries(perMeal).find(([k]) => slotKey(k) === key)
  return hit ? hit[1] : null
}

/**
 * Rolls up a day's planned menu into one person's macro intake (one portion
 * per planned dish) and, when a daily target is
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
    totals = addPortion(totals, entry.nutrition)
    if (entry.mealCategory) {
      const prev = mealAcc.get(entry.mealCategory) ?? { ...ZERO }
      mealAcc.set(entry.mealCategory, addPortion(prev, entry.nutrition))
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

  const byMeal: MealBreakdown[] = [...mealAcc.entries()].map(([mealCategory, t]) => {
    const mealTotals = roundTotals(t)
    const mealTarget = mealTargetFor(target?.per_meal, mealCategory)
    const goal = mealTarget?.calories
    return {
      mealCategory,
      totals: mealTotals,
      target: mealTarget,
      calorieDelta: goal ? mealTotals.calories - goal : null,
    }
  })

  return {
    totals,
    target: dailyTarget,
    delta,
    byMeal,
    partial: missingCount > 0,
    missingCount,
  }
}
