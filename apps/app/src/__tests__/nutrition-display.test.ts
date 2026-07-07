import { describe, it, expect } from 'vitest'
import { roundNutrition } from '../utils/nutritionDisplay'
import type { Nutrition } from '@recetario/shared'

// regression: nutrition per serving must NOT scale with batch size (found during 2026-07-02 audit)
describe('roundNutrition', () => {
  it('rounds calories to the nearest integer', () => {
    const nutrition: Nutrition = { calories: 479.6, protein_g: 0, carbs_g: 0, fat_g: 0 }
    expect(roundNutrition(nutrition).calories).toBe(480)
  })

  it('rounds macros to one decimal place', () => {
    const nutrition: Nutrition = { calories: 0, protein_g: 12.34, carbs_g: 45.678, fat_g: 8.05 }
    const result = roundNutrition(nutrition)
    expect(result.protein_g).toBe(12.3)
    expect(result.carbs_g).toBe(45.7)
    expect(result.fat_g).toBe(8.1)
  })

  it('rounds fiber to one decimal place when present', () => {
    const nutrition: Nutrition = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 3.26 }
    expect(roundNutrition(nutrition).fiber_g).toBe(3.3)
  })

  it('omits fiber when not present on the recipe', () => {
    const nutrition: Nutrition = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    expect(roundNutrition(nutrition).fiber_g).toBeUndefined()
  })

  it('does not scale values by servings — same nutrition regardless of batch size', () => {
    const nutrition: Nutrition = { calories: 480, protein_g: 20, carbs_g: 50, fat_g: 15 }
    // Same per-serving nutrition object, no servings/base-servings parameter exists —
    // calling it twice must yield identical output, proving there is no hidden scaling.
    expect(roundNutrition(nutrition)).toEqual(roundNutrition(nutrition))
    expect(roundNutrition(nutrition).calories).toBe(480)
  })
})
