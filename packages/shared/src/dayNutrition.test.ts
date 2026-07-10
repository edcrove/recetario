import { describe, it, expect } from 'vitest'
import { computeDayNutrition, type DayNutritionEntry } from './dayNutrition.js'
import type { NutritionTargets } from './schema.js'

const N = (c: number, p: number, cb: number, f: number) => ({
  calories: c,
  protein_g: p,
  carbs_g: cb,
  fat_g: f,
})

const target: NutritionTargets = {
  daily_calories: 2000,
  daily_protein_g: 100,
  daily_carbs_g: 250,
  daily_fat_g: 70,
}

describe('computeDayNutrition', () => {
  it('sums per-serving nutrition times entry servings', () => {
    const entries: DayNutritionEntry[] = [
      { nutrition: N(400, 20, 40, 10), servings: 2 }, // 800/40/80/20
      { nutrition: N(300, 15, 30, 5), servings: 1 }, // 300/15/30/5
    ]
    const r = computeDayNutrition(entries, null)
    expect(r.totals).toEqual({ calories: 1100, protein_g: 55, carbs_g: 110, fat_g: 25 })
    expect(r.target).toBeNull()
    expect(r.delta).toBeNull()
    expect(r.partial).toBe(false)
    expect(r.missingCount).toBe(0)
  })

  it('computes a signed delta vs the daily target (over positive, under negative)', () => {
    const entries: DayNutritionEntry[] = [{ nutrition: N(2200, 90, 260, 80), servings: 1 }]
    const r = computeDayNutrition(entries, target)
    expect(r.delta).toEqual({
      calories: 200, // over
      protein_g: -10, // under
      carbs_g: 10, // over
      fat_g: 10, // over
    })
    expect(r.target).toEqual({ calories: 2000, protein_g: 100, carbs_g: 250, fat_g: 70 })
  })

  it('excludes recipes without nutrition and flags the day partial', () => {
    const entries: DayNutritionEntry[] = [
      { nutrition: N(400, 20, 40, 10), servings: 1 },
      { nutrition: null, servings: 2 },
      { nutrition: null, servings: 1 },
    ]
    const r = computeDayNutrition(entries, target)
    expect(r.totals).toEqual({ calories: 400, protein_g: 20, carbs_g: 40, fat_g: 10 })
    expect(r.partial).toBe(true)
    expect(r.missingCount).toBe(2)
  })

  it('groups per-meal totals only for meals with entries', () => {
    const entries: DayNutritionEntry[] = [
      { mealCategory: 'almuerzo', nutrition: N(400, 20, 40, 10), servings: 1 },
      { mealCategory: 'almuerzo', nutrition: N(100, 5, 10, 2), servings: 1 },
      { mealCategory: 'cena', nutrition: N(600, 30, 60, 15), servings: 1 },
    ]
    const r = computeDayNutrition(entries, null)
    expect(r.byMeal).toEqual([
      {
        mealCategory: 'almuerzo',
        totals: { calories: 500, protein_g: 25, carbs_g: 50, fat_g: 12 },
      },
      { mealCategory: 'cena', totals: { calories: 600, protein_g: 30, carbs_g: 60, fat_g: 15 } },
    ])
  })

  it('leaves a macro delta null when that target is zero/unset', () => {
    const r = computeDayNutrition([{ nutrition: N(400, 20, 40, 10), servings: 1 }], {
      daily_calories: 2000,
      daily_protein_g: 0,
      daily_carbs_g: 250,
      daily_fat_g: 0,
    })
    expect(r.delta).toEqual({ calories: -1600, protein_g: null, carbs_g: -210, fat_g: null })
  })

  it('leaves every delta null when all targets are zero', () => {
    const r = computeDayNutrition([{ nutrition: N(400, 20, 40, 10), servings: 1 }], {
      daily_calories: 0,
      daily_protein_g: 0,
      daily_carbs_g: 0,
      daily_fat_g: 0,
    })
    expect(r.delta).toEqual({ calories: null, protein_g: null, carbs_g: null, fat_g: null })
  })

  it('handles an empty day', () => {
    const r = computeDayNutrition([], target)
    expect(r.totals).toEqual({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
    expect(r.delta).toEqual({ calories: -2000, protein_g: -100, carbs_g: -250, fat_g: -70 })
    expect(r.byMeal).toEqual([])
    expect(r.partial).toBe(false)
  })

  it('rounds calories to integers and macros to one decimal', () => {
    const r = computeDayNutrition([{ nutrition: N(133.33, 7.77, 11.11, 3.33), servings: 3 }], null)
    expect(r.totals).toEqual({ calories: 400, protein_g: 23.3, carbs_g: 33.3, fat_g: 10 })
  })
})
