import { describe, it, expect } from 'vitest'
import { DEFAULT_NUTRITION_TARGETS } from '@recetario/shared'
import { TARGET_MAX, withDailyTarget, withMealCalories } from '../utils/profileTargets'

const saved = {
  daily_calories: 1800,
  daily_protein_g: 90,
  daily_carbs_g: 200,
  daily_fat_g: 60,
  per_meal: { Cena: { calories: 600, protein_g: 30 }, Almuerzo: { calories: 700 } },
}

describe('withDailyTarget', () => {
  it('steps one daily field and keeps the rest, per-meal goals included', () => {
    expect(withDailyTarget(saved, 'daily_calories', 100)).toEqual({
      ...saved,
      daily_calories: 1900,
    })
  })

  it('starts from the displayed defaults when nothing was saved', () => {
    expect(withDailyTarget(null, 'daily_protein_g', 5)).toEqual({
      ...DEFAULT_NUTRITION_TARGETS,
      daily_protein_g: 80,
    })
    expect(withDailyTarget(undefined, 'daily_fat_g', -5)).toEqual({
      ...DEFAULT_NUTRITION_TARGETS,
      daily_fat_g: 73,
    })
  })

  it('stays within 0 and the schema maximum', () => {
    expect(withDailyTarget({ ...saved, daily_fat_g: 3 }, 'daily_fat_g', -5).daily_fat_g).toBe(0)
    expect(
      withDailyTarget({ ...saved, daily_carbs_g: 1495 }, 'daily_carbs_g', 10).daily_carbs_g,
    ).toBe(TARGET_MAX.daily_carbs_g)
  })
})

describe('withMealCalories', () => {
  it("steps one meal's calories and keeps its other goals, the other meals and the daily targets", () => {
    expect(withMealCalories(saved, 'Cena', 50)).toEqual({
      ...saved,
      per_meal: { Cena: { calories: 650, protein_g: 30 }, Almuerzo: { calories: 700 } },
    })
  })

  it('a meal without a goal starts at 0 and never goes negative', () => {
    expect(withMealCalories(null, 'Desayuno', 50)).toEqual({
      ...DEFAULT_NUTRITION_TARGETS,
      per_meal: { Desayuno: { calories: 50 } },
    })
    expect(withMealCalories(saved, 'Merienda', -50).per_meal?.['Merienda']).toEqual({
      calories: 0,
    })
  })
})
