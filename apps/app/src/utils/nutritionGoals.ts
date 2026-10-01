import { mealTargetFor, type NutritionTargets } from '@recetario/shared'

export type DeltaStatus = 'ok' | 'over' | 'under' | 'none'

/** Within ±10% of target reads as on-track. */
export function deltaStatus(delta: number | null, target: number): DeltaStatus {
  if (delta === null || target <= 0) return 'none'
  const tolerance = target * 0.1
  if (Math.abs(delta) <= tolerance) return 'ok'
  return delta > 0 ? 'over' : 'under'
}

/** Human phrase for a single macro delta: 'faltan 300' / '+120 sobre el objetivo' / 'en objetivo'. */
export function deltaLabel(delta: number | null, target: number): string {
  const status = deltaStatus(delta, target)
  if (status === 'none' || delta === null) return ''
  if (status === 'ok') return 'en objetivo'
  return delta > 0 ? `+${Math.round(delta)} sobre objetivo` : `faltan ${Math.round(-delta)}`
}

const SLOT_PHRASE: Record<string, string> = {
  desayuno: 'el desayuno',
  almuerzo: 'el almuerzo',
  merienda: 'la merienda',
  cena: 'la cena',
}

/** Menu slots compare ignoring case and accents ("Cena" = "cena"). */
export function sameSlot(a: string, b: string): boolean {
  const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  return key(a) === key(b)
}

export interface PickProjection {
  text: string
  status: DeltaStatus
}

/**
 * What adding a recipe to a slot does to the person's goal, shown on the pick
 * screen before choosing: "Con esta receta el almuerzo queda en 780 / 700 kcal".
 * One portion per dish (D-2026-10-01-5). The meal goal wins when the profile
 * has one for this slot; otherwise the daily goal. Null without a goal or
 * without the recipe's nutrition (never guessed).
 */
export function pickProjection(args: {
  slot: string
  recipeCalories: number | null | undefined
  dayCalories: number
  mealCalories: number
  targets: NutritionTargets | null | undefined
}): PickProjection | null {
  const { slot, recipeCalories, dayCalories, mealCalories, targets } = args
  if (recipeCalories == null || !targets) return null
  const mealGoal = mealTargetFor(targets.per_meal, slot)?.calories ?? 0
  if (mealGoal > 0) {
    const total = Math.round(mealCalories + recipeCalories)
    const phrase = SLOT_PHRASE[slot.trim().toLowerCase()] ?? slot
    return {
      text: `Con esta receta ${phrase} queda en ${total} / ${mealGoal} kcal`,
      status: deltaStatus(total - mealGoal, mealGoal),
    }
  }
  const dailyGoal = targets.daily_calories
  if (dailyGoal > 0) {
    const total = Math.round(dayCalories + recipeCalories)
    return {
      text: `Con esta receta el día queda en ${total} / ${dailyGoal} kcal`,
      status: deltaStatus(total - dailyGoal, dailyGoal),
    }
  }
  return null
}
