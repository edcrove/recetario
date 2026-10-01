import { describe, expect, it } from 'vitest'
import * as shared from './index.js'

describe('shared entrypoint', () => {
  it('re-exports the domain schemas and helpers', () => {
    expect(shared.RecipeSchema).toBeDefined()
    expect(shared.computeDayNutrition).toBeTypeOf('function')
    expect(shared.normalizeIngredientName).toBeTypeOf('function')
  })
})
