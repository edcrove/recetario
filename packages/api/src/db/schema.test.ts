import { describe, it, expect } from 'vitest'
import { recipes, ingredients, steps, apiKeys } from './schema/index.js'

describe('Drizzle schema', () => {
  it('recipes table has expected columns', () => {
    expect(Object.keys(recipes)).toContain('id')
  })
  it('ingredients table has recipeId', () => {
    expect(Object.keys(ingredients)).toContain('recipeId')
  })
  it('steps table has position', () => {
    expect(Object.keys(steps)).toContain('position')
  })
  it('apiKeys table has keyHash', () => {
    expect(Object.keys(apiKeys)).toContain('keyHash')
  })
})
