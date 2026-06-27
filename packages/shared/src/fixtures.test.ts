import { describe, it, expect } from 'vitest'
import { DEMO_RECIPES } from './fixtures.js'
import { CreateRecipeSchema } from './schema.js'

describe('DEMO_RECIPES fixtures', () => {
  it('has 3 demo recipes', () => {
    expect(DEMO_RECIPES).toHaveLength(3)
  })

  it('each recipe parses with CreateRecipeSchema', () => {
    for (const recipe of DEMO_RECIPES) {
      const result = CreateRecipeSchema.safeParse(recipe)
      expect(
        result.success,
        `Recipe "${recipe.title}" failed validation: ${JSON.stringify(result)}`,
      ).toBe(true)
    }
  })

  it('recipes have unique titles', () => {
    const titles = DEMO_RECIPES.map((r) => r.title)
    const unique = new Set(titles)
    expect(unique.size).toBe(titles.length)
  })
})
