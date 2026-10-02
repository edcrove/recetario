import { describe, it, expect } from 'vitest'
import { deltaStatus, deltaLabel, pickProjection, sameSlot } from '../utils/nutritionGoals'

describe('deltaStatus', () => {
  it('is ok within ±10% of target', () => {
    expect(deltaStatus(50, 2000)).toBe('ok') // 2.5%
    expect(deltaStatus(-150, 2000)).toBe('ok') // 7.5%
  })
  it('is over when above tolerance', () => {
    expect(deltaStatus(300, 2000)).toBe('over')
  })
  it('is under when below tolerance', () => {
    expect(deltaStatus(-400, 2000)).toBe('under')
  })
  it('is none when no delta or no target', () => {
    expect(deltaStatus(null, 2000)).toBe('none')
    expect(deltaStatus(100, 0)).toBe('none')
  })
})

describe('deltaLabel', () => {
  it('says how much is missing when under', () => {
    expect(deltaLabel(-300, 2000)).toBe('faltan 300 kcal')
  })
  it('says how much over when above', () => {
    expect(deltaLabel(250, 2000)).toBe('+250 kcal sobre objetivo')
  })
  it('says on target when within tolerance', () => {
    expect(deltaLabel(50, 2000)).toBe('en objetivo')
  })
  it('is empty when no target', () => {
    expect(deltaLabel(100, 0)).toBe('')
    expect(deltaLabel(null, 2000)).toBe('')
  })
})

// Story "goals in Perfil + day progress/delta in planner": "Pick screen with
// goals set: projected delta preview ('con esta receta el almuerzo queda en
// 780 / 700 kcal')".
describe('pickProjection', () => {
  const daily = { daily_calories: 2000, daily_protein_g: 0, daily_carbs_g: 0, daily_fat_g: 0 }
  const withLunch = { ...daily, per_meal: { Almuerzo: { calories: 700 } } }

  it('uses the meal goal when the slot has one (the AC example)', () => {
    expect(
      pickProjection({
        slot: 'Almuerzo',
        recipeCalories: 480,
        dayCalories: 1200,
        mealCalories: 300,
        targets: withLunch,
      }),
    ).toEqual({ text: 'Con esta receta el almuerzo queda en 780 / 700 kcal', status: 'over' })
  })

  it('reads within ±10% of the meal goal as on-track', () => {
    expect(
      pickProjection({
        slot: 'Almuerzo',
        recipeCalories: 650,
        dayCalories: 0,
        mealCalories: 0,
        targets: withLunch,
      }),
    ).toEqual({ text: 'Con esta receta el almuerzo queda en 650 / 700 kcal', status: 'ok' })
  })

  it('reads well below the meal goal as under', () => {
    expect(
      pickProjection({
        slot: 'Almuerzo',
        recipeCalories: 200,
        dayCalories: 0,
        mealCalories: 0,
        targets: withLunch,
      })?.status,
    ).toBe('under')
  })

  it('matches the meal goal ignoring case and accents, with the right article', () => {
    const t = { ...daily, per_meal: { cena: { calories: 600 } } }
    expect(
      pickProjection({
        slot: 'Cena',
        recipeCalories: 600,
        dayCalories: 0,
        mealCalories: 0,
        targets: t,
      })?.text,
    ).toBe('Con esta receta la cena queda en 600 / 600 kcal')
    const m = { ...daily, per_meal: { Merienda: { calories: 300 } } }
    expect(
      pickProjection({
        slot: 'Merienda',
        recipeCalories: 100,
        dayCalories: 0,
        mealCalories: 0,
        targets: m,
      })?.text,
    ).toBe('Con esta receta la merienda queda en 100 / 300 kcal')
    const d = { ...daily, per_meal: { Desayuno: { calories: 400 } } }
    expect(
      pickProjection({
        slot: 'Desayuno',
        recipeCalories: 410.6,
        dayCalories: 0,
        mealCalories: 0,
        targets: d,
      })?.text,
    ).toBe('Con esta receta el desayuno queda en 411 / 400 kcal')
  })

  it('a slot with stray spaces still gets its article', () => {
    expect(
      pickProjection({
        slot: ' Almuerzo ',
        recipeCalories: 100,
        dayCalories: 0,
        mealCalories: 0,
        targets: withLunch,
      })?.text,
    ).toBe('Con esta receta el almuerzo queda en 100 / 700 kcal')
  })

  it('a slot without a known article is named as is', () => {
    const t = { ...daily, per_meal: { 'Snacks/Otros': { calories: 200 } } }
    expect(
      pickProjection({
        slot: 'Snacks/Otros',
        recipeCalories: 150,
        dayCalories: 0,
        mealCalories: 50,
        targets: t,
      })?.text,
    ).toBe('Con esta receta Snacks/Otros queda en 200 / 200 kcal')
  })

  it('falls back to the daily goal when the slot has none, adding to the day so far', () => {
    expect(
      pickProjection({
        slot: 'Cena',
        recipeCalories: 900,
        dayCalories: 1300,
        mealCalories: 999,
        targets: withLunch,
      }),
    ).toEqual({ text: 'Con esta receta el día queda en 2200 / 2000 kcal', status: 'ok' })
    expect(
      pickProjection({
        slot: 'Cena',
        recipeCalories: 500,
        dayCalories: 600,
        mealCalories: 0,
        targets: daily,
      })?.status,
    ).toBe('under')
  })

  it('a meal goal of 0 does not count as a goal', () => {
    const t = { ...daily, per_meal: { Almuerzo: { calories: 0 } } }
    expect(
      pickProjection({
        slot: 'Almuerzo',
        recipeCalories: 500,
        dayCalories: 0,
        mealCalories: 0,
        targets: t,
      })?.text,
    ).toBe('Con esta receta el día queda en 500 / 2000 kcal')
  })

  it('no preview without goals, without a daily calorie goal, or without the recipe nutrition', () => {
    const base = { slot: 'Almuerzo', dayCalories: 0, mealCalories: 0 }
    expect(pickProjection({ ...base, recipeCalories: 500, targets: null })).toBeNull()
    expect(pickProjection({ ...base, recipeCalories: 500, targets: undefined })).toBeNull()
    expect(
      pickProjection({ ...base, recipeCalories: 500, targets: { ...daily, daily_calories: 0 } }),
    ).toBeNull()
    expect(pickProjection({ ...base, recipeCalories: null, targets: withLunch })).toBeNull()
    expect(pickProjection({ ...base, recipeCalories: undefined, targets: withLunch })).toBeNull()
  })

  it('a recipe with 0 kcal still projects (0 is data, not missing)', () => {
    expect(
      pickProjection({
        slot: 'Almuerzo',
        recipeCalories: 0,
        dayCalories: 0,
        mealCalories: 100,
        targets: withLunch,
      })?.text,
    ).toBe('Con esta receta el almuerzo queda en 100 / 700 kcal')
  })
})

describe('sameSlot', () => {
  it('ignores case, accents and surrounding spaces', () => {
    expect(sameSlot('Almuerzo', 'almuerzo')).toBe(true)
    expect(sameSlot(' Cena ', 'cena')).toBe(true)
    expect(sameSlot('Médiodía', 'mediodia')).toBe(true)
  })

  it('different slots are different', () => {
    expect(sameSlot('Cena', 'Almuerzo')).toBe(false)
  })
})
