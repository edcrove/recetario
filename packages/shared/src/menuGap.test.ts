import { describe, it, expect } from 'vitest'
import { computeMenuGaps, type PlannedMeal } from './menuGap.js'

const meal = (over: Partial<PlannedMeal>): PlannedMeal => ({
  date: '2026-07-06',
  slot: 'Cena',
  recipeId: 'r1',
  recipeName: 'Receta',
  ingredients: [],
  ...over,
})

describe('computeMenuGaps', () => {
  it('marks a meal cookable when every ingredient is on hand', () => {
    const [gap] = computeMenuGaps(
      [
        meal({
          ingredients: [
            { name: 'Pollo', key: 'pollo' },
            { name: 'Arroz', key: 'arroz' },
          ],
        }),
      ],
      new Set(['pollo', 'arroz']),
    )
    expect(gap!.cookable).toBe(true)
    expect(gap!.missingIngredients).toEqual([])
  })

  it('lists the missing ingredients and marks the meal not cookable', () => {
    const [gap] = computeMenuGaps(
      [
        meal({
          ingredients: [
            { name: 'Pollo', key: 'pollo' },
            { name: 'Crema', key: 'crema' },
          ],
        }),
      ],
      new Set(['pollo']),
    )
    expect(gap!.cookable).toBe(false)
    expect(gap!.missingIngredients).toEqual(['Crema'])
  })

  it('de-duplicates missing ingredients by canonical key', () => {
    const [gap] = computeMenuGaps(
      [
        meal({
          ingredients: [
            { name: 'Suprema de pollo', key: 'pollo' },
            { name: 'Pechuga', key: 'pollo' },
          ],
        }),
      ],
      new Set(),
    )
    expect(gap!.missingIngredients).toEqual(['Suprema de pollo'])
  })

  it('treats a meal with no ingredients as not cookable', () => {
    const [gap] = computeMenuGaps([meal({ ingredients: [] })], new Set(['pollo']))
    expect(gap!.cookable).toBe(false)
  })

  it('returns empty for no meals', () => {
    expect(computeMenuGaps([], new Set())).toEqual([])
  })
})
