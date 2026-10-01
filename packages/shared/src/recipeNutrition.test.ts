import { describe, it, expect } from 'vitest'
import { nutritionAfterEdit, scalePerServing } from './recipeNutrition.js'

const nutrition = { calories: 600, protein_g: 30, carbs_g: 60, fat_g: 20, fiber_g: 8 }
const ingredients = [
  { name: 'Lentejas', quantity: 300, unit: 'g' as const },
  { name: 'Sal', quantity: null, unit: null },
]
const base = { servings: 4, nutrition, ingredients }

describe('nutritionAfterEdit', () => {
  it('explicit nutrition wins, and null clears it', () => {
    const next = { ...nutrition, calories: 500 }
    expect(nutritionAfterEdit(base, { nutrition: next, servings: 8 })).toEqual(next)
    expect(nutritionAfterEdit(base, { nutrition: null })).toBeNull()
  })

  it('leaves it unchanged when nothing relevant changed', () => {
    expect(nutritionAfterEdit(base, {})).toBeUndefined()
    expect(nutritionAfterEdit(base, { servings: 4 })).toBeUndefined()
    // Same ingredients re-sent (case/spacing differences don't count)
    expect(
      nutritionAfterEdit(base, {
        ingredients: [{ ...ingredients[0]!, name: ' lentejas ' }, ingredients[1]!],
      }),
    ).toBeUndefined()
  })

  it('clears it when the ingredients change', () => {
    expect(
      nutritionAfterEdit(base, { ingredients: [{ ...ingredients[0]!, quantity: 500 }] }),
    ).toBeNull()
    expect(
      nutritionAfterEdit(base, {
        ingredients: [...ingredients, { name: 'Chorizo', quantity: 1, unit: 'unit' }],
      }),
    ).toBeNull()
  })

  it('rescales per serving when only the servings change', () => {
    expect(nutritionAfterEdit(base, { servings: 8 })).toEqual({
      calories: 300,
      protein_g: 15,
      carbs_g: 30,
      fat_g: 10,
      fiber_g: 4,
    })
    const { fiber_g: _f, ...noFiber } = nutrition
    expect(nutritionAfterEdit({ ...base, nutrition: noFiber }, { servings: 3 })).toEqual({
      calories: 800,
      protein_g: 40,
      carbs_g: 80,
      fat_g: 26.7,
    })
  })

  it('does nothing for a recipe without nutrition', () => {
    expect(nutritionAfterEdit({ ...base, nutrition: null }, { servings: 8 })).toBeUndefined()
  })
})

describe('scalePerServing', () => {
  it('scales every present nutrient and rounds like the app', () => {
    expect(
      scalePerServing(
        {
          calories: 301,
          protein_g: 10.04,
          carbs_g: 40,
          fat_g: 5,
          fiber_g: 3,
          sugars_g: 12.3,
          saturated_fat_g: 2.25,
          sodium_mg: 455,
        },
        2,
      ),
    ).toEqual({
      calories: 602,
      protein_g: 20.1,
      carbs_g: 80,
      fat_g: 10,
      fiber_g: 6,
      sugars_g: 24.6,
      saturated_fat_g: 4.5,
      sodium_mg: 910,
    })
  })
  it('keeps absent optional nutrients absent', () => {
    expect(scalePerServing({ calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1 }, 0.5)).toEqual({
      calories: 50,
      protein_g: 0.5,
      carbs_g: 0.5,
      fat_g: 0.5,
    })
  })
})
