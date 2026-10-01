import { describe, it, expect } from 'vitest'
import { computeDayNutrition, mealTargetFor, type DayNutritionEntry } from './dayNutrition.js'
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
  it("sums one portion per planned dish (a person's intake, not the household's)", () => {
    const entries: DayNutritionEntry[] = [
      { nutrition: N(400, 20, 40, 10) },
      { nutrition: N(300, 15, 30, 5) },
    ]
    const r = computeDayNutrition(entries, null)
    expect(r.totals).toEqual({ calories: 700, protein_g: 35, carbs_g: 70, fat_g: 15 })
    expect(r.target).toBeNull()
    expect(r.delta).toBeNull()
    expect(r.partial).toBe(false)
    expect(r.missingCount).toBe(0)
  })

  it('computes a signed delta vs the daily target (over positive, under negative)', () => {
    const entries: DayNutritionEntry[] = [{ nutrition: N(2200, 90, 260, 80) }]
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
      { nutrition: N(400, 20, 40, 10) },
      { nutrition: null },
      { nutrition: null },
    ]
    const r = computeDayNutrition(entries, target)
    expect(r.totals).toEqual({ calories: 400, protein_g: 20, carbs_g: 40, fat_g: 10 })
    expect(r.partial).toBe(true)
    expect(r.missingCount).toBe(2)
  })

  it('groups per-meal totals only for meals with entries', () => {
    const entries: DayNutritionEntry[] = [
      { mealCategory: 'almuerzo', nutrition: N(400, 20, 40, 10) },
      { mealCategory: 'almuerzo', nutrition: N(100, 5, 10, 2) },
      { mealCategory: 'cena', nutrition: N(600, 30, 60, 15) },
    ]
    const r = computeDayNutrition(entries, null)
    expect(r.byMeal).toEqual([
      {
        mealCategory: 'almuerzo',
        totals: { calories: 500, protein_g: 25, carbs_g: 50, fat_g: 12 },
        target: null,
        calorieDelta: null,
      },
      {
        mealCategory: 'cena',
        totals: { calories: 600, protein_g: 30, carbs_g: 60, fat_g: 15 },
        target: null,
        calorieDelta: null,
      },
    ])
  })

  it('compares each meal against its per-meal goal (slot keys, any case)', () => {
    const r = computeDayNutrition(
      [
        { mealCategory: 'Cena', nutrition: N(800, 30, 60, 15) },
        { mealCategory: 'Almuerzo', nutrition: N(500, 20, 40, 10) },
        { mealCategory: 'Desayuno', nutrition: N(300, 10, 40, 5) },
      ],
      {
        ...target,
        // 'Cena' as the app writes it; 'almuerzo' as an older slug; protein-only breakfast goal
        per_meal: {
          Cena: { calories: 650 },
          almuerzo: { calories: 600 },
          Desayuno: { protein_g: 20 },
        },
      },
    )
    const byMeal = Object.fromEntries(r.byMeal.map((m) => [m.mealCategory, m]))
    expect(byMeal['Cena']).toMatchObject({ target: { calories: 650 }, calorieDelta: 150 })
    expect(byMeal['Almuerzo']).toMatchObject({ target: { calories: 600 }, calorieDelta: -100 })
    expect(byMeal['Desayuno']).toMatchObject({ target: { protein_g: 20 }, calorieDelta: null })
  })

  it('mealTargetFor matches accents and returns null without goals', () => {
    expect(mealTargetFor(undefined, 'Cena')).toBeNull()
    expect(mealTargetFor({ Merienda: { calories: 200 } }, 'merienda')).toEqual({ calories: 200 })
    expect(mealTargetFor({ Cena: { calories: 1 } }, 'Snacks/Otros')).toBeNull()
  })

  it('leaves a macro delta null when that target is zero/unset', () => {
    const r = computeDayNutrition([{ nutrition: N(400, 20, 40, 10) }], {
      daily_calories: 2000,
      daily_protein_g: 0,
      daily_carbs_g: 250,
      daily_fat_g: 0,
    })
    expect(r.delta).toEqual({ calories: -1600, protein_g: null, carbs_g: -210, fat_g: null })
  })

  it('leaves every delta null when all targets are zero', () => {
    const r = computeDayNutrition([{ nutrition: N(400, 20, 40, 10) }], {
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
    const r = computeDayNutrition(
      [{ nutrition: N(133.33, 7.77, 11.11, 3.33) }, { nutrition: N(133.33, 7.77, 11.11, 3.33) }],
      null,
    )
    expect(r.totals).toEqual({ calories: 267, protein_g: 15.5, carbs_g: 22.2, fat_g: 6.7 })
  })
})
