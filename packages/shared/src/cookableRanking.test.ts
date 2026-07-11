import { describe, it, expect } from 'vitest'
import { rankCookable, type RankInputRecipe } from './cookableRanking.js'

const r = (id: string, title: string, ings: [string, string][]): RankInputRecipe => ({
  id,
  title,
  ingredients: ings.map(([name, key]) => ({ name, key })),
})

describe('rankCookable', () => {
  it('ranks by fraction of ingredients in the pantry, most cookable first', () => {
    const pantry = new Set(['pollo', 'arroz'])
    const result = rankCookable(
      [
        r('a', 'Guiso', [
          ['Pollo', 'pollo'],
          ['Arroz', 'arroz'],
          ['Morrón', 'morron'],
        ]),
        r('b', 'Arroz blanco', [
          ['Arroz', 'arroz'],
          ['Sal', 'sal'],
        ]),
        r('c', 'Pollo al horno', [['Pollo', 'pollo']]),
      ],
      pantry,
    )
    // c is fully cookable (1/1), then b (1/2), then a (2/3)? no — sort by fraction:
    // c=1.0, a=0.667, b=0.5
    expect(result.map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(result[0]).toMatchObject({ matchedCount: 1, totalCount: 1, missingIngredients: [] })
    expect(result[1]).toMatchObject({ matchedCount: 2, totalCount: 3 })
    expect(result[1]!.missingIngredients).toEqual(['Morrón'])
  })

  it('lists the display names of missing ingredients', () => {
    const result = rankCookable(
      [
        r('a', 'Tarta', [
          ['Huevo', 'huevo'],
          ['Cebolla', 'cebolla'],
        ]),
      ],
      new Set(['huevo']),
    )
    expect(result[0]!.missingIngredients).toEqual(['Cebolla'])
    expect(result[0]!.matchFraction).toBe(0.5)
  })

  it('gives a recipe with no ingredients a fraction of 0', () => {
    const result = rankCookable([r('a', 'Vacía', [])], new Set(['pollo']))
    expect(result[0]).toMatchObject({ matchFraction: 0, matchedCount: 0, totalCount: 0 })
  })

  it('breaks fraction ties by title', () => {
    const pantry = new Set<string>()
    const result = rankCookable([r('b', 'Zeta', []), r('a', 'Alfa', [])], pantry)
    expect(result.map((x) => x.title)).toEqual(['Alfa', 'Zeta'])
  })

  it('returns empty for no recipes', () => {
    expect(rankCookable([], new Set())).toEqual([])
  })
})
