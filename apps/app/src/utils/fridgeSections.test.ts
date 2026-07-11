import { describe, it, expect } from 'vitest'
import { splitSuggestions, type Suggestion } from './fridgeSections'

const s = (over: Partial<Suggestion>): Suggestion => ({
  id: 'x',
  title: 'X',
  matchedCount: 1,
  totalCount: 1,
  matchFraction: 1,
  missingIngredients: [],
  goalFit: null,
  nutrition: null,
  ...over,
})

describe('splitSuggestions', () => {
  it('puts fully-covered recipes in cookable', () => {
    const { cookable, almost } = splitSuggestions([s({ id: 'a', missingIngredients: [] })])
    expect(cookable.map((x) => x.id)).toEqual(['a'])
    expect(almost).toEqual([])
  })

  it('puts recipes missing 1–2 ingredients in almost', () => {
    const { cookable, almost } = splitSuggestions([
      s({ id: 'a', missingIngredients: ['Crema'] }),
      s({ id: 'b', missingIngredients: ['Crema', 'Sal'] }),
    ])
    expect(cookable).toEqual([])
    expect(almost.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('drops recipes missing 3 or more ingredients', () => {
    const { cookable, almost } = splitSuggestions([
      s({ id: 'a', missingIngredients: ['A', 'B', 'C'] }),
    ])
    expect(cookable).toEqual([])
    expect(almost).toEqual([])
  })

  it('drops recipes with no ingredients', () => {
    const { cookable, almost } = splitSuggestions([s({ id: 'a', totalCount: 0 })])
    expect(cookable).toEqual([])
    expect(almost).toEqual([])
  })

  it('returns empty buckets for empty input', () => {
    expect(splitSuggestions([])).toEqual({ cookable: [], almost: [] })
  })
})
