import { describe, it, expect, vi } from 'vitest'
import type { Recipe } from '@recetario/shared'
import { fetchAllRecipes, RECIPES_PAGE } from '../utils/allRecipes'

const recipes = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }) as Recipe)

describe('fetchAllRecipes', () => {
  it('keeps paging until a short page, so none past the first page is lost', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce(recipes(RECIPES_PAGE))
      .mockResolvedValueOnce(recipes(RECIPES_PAGE, 100))
      .mockResolvedValueOnce(recipes(7, 200))
    const all = await fetchAllRecipes<Recipe>(list)
    expect(all).toHaveLength(207)
    expect(all[206]?.id).toBe('r206')
    expect(list.mock.calls.map((c) => c[0])).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100 },
      { limit: 100, offset: 200 },
    ])
  })

  it('stops after one call when everything fits, or on an exact multiple', async () => {
    const one = vi.fn().mockResolvedValueOnce(recipes(3))
    expect(await fetchAllRecipes(one)).toHaveLength(3)
    expect(one).toHaveBeenCalledTimes(1)
    const exact = vi.fn().mockResolvedValueOnce(recipes(100)).mockResolvedValueOnce([])
    expect(await fetchAllRecipes(exact)).toHaveLength(100)
    expect(exact).toHaveBeenCalledTimes(2)
  })
})
