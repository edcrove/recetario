import { describe, it, expect } from 'vitest'
import { topRecipeLabel, statsWindowLabel } from '../utils/statsLabels'

describe('topRecipeLabel', () => {
  it('uses the title snapshot instead of the id', () => {
    expect(topRecipeLabel({ recipeId: 'abc', title: 'Milanesas' })).toBe('Milanesas')
  })
  it('flags deleted recipes and falls back when no title was captured', () => {
    expect(topRecipeLabel({ recipeId: null, title: 'Guiso' })).toBe('Guiso (eliminada)')
    expect(topRecipeLabel({ recipeId: 'abc', title: null })).toBe('Receta')
    expect(topRecipeLabel({ recipeId: null, title: '  ' })).toBe('Receta (eliminada)')
  })
})

describe('statsWindowLabel', () => {
  it('formats the window start in Spanish without shifting the day', () => {
    expect(statsWindowLabel('2026-07-03')).toMatch(/^desde el 3 jul/)
  })
})
