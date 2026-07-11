import { describe, it, expect } from 'vitest'
import { rankSuggestions, type SuggestionRecipe } from './suggestionRanking.js'
import type { Nutrition } from './schema.js'

const nut = (calories: number): Nutrition => ({ calories, protein_g: 0, carbs_g: 0, fat_g: 0 })
const r = (
  id: string,
  title: string,
  ings: [string, string][],
  nutrition: Nutrition | null = null,
): SuggestionRecipe => ({
  id,
  title,
  ingredients: ings.map(([name, key]) => ({ name, key })),
  nutrition,
})

const remaining = { calories: 500, protein_g: 0, carbs_g: 0, fat_g: 0 }

describe('rankSuggestions', () => {
  it('ranks by ingredient coverage first', () => {
    const result = rankSuggestions(
      [
        r('a', 'Falta uno', [
          ['Pollo', 'pollo'],
          ['Arroz', 'arroz'],
          ['Sal', 'sal'],
        ]),
        r('b', 'Todo', [
          ['Pollo', 'pollo'],
          ['Arroz', 'arroz'],
        ]),
      ],
      new Set(['pollo', 'arroz']),
      null,
    )
    expect(result.map((x) => x.id)).toEqual(['b', 'a'])
    expect(result[0]).toMatchObject({ matchedCount: 2, totalCount: 2, goalFit: null })
    expect(result[1]!.missingIngredients).toEqual(['Sal'])
  })

  it('breaks coverage ties by closeness to the remaining goal', () => {
    const have = new Set(['pollo'])
    const result = rankSuggestions(
      [
        r('far', 'Lejos', [['Pollo', 'pollo']], nut(1500)), // way over 500
        r('near', 'Cerca', [['Pollo', 'pollo']], nut(480)), // ~500
      ],
      have,
      remaining,
    )
    expect(result.map((x) => x.id)).toEqual(['near', 'far'])
    expect(result[0]!.goalFit).toBe('dentro')
    expect(result[1]!.goalFit).toBe('lejos')
  })

  it('classifies goalFit as dentro / cerca / lejos', () => {
    const have = new Set<string>()
    const result = rankSuggestions(
      [
        r('a', 'A', [], nut(500)), // d=0 → dentro
        r('b', 'B', [], nut(700)), // d=0.4 → cerca
        r('c', 'C', [], nut(1200)), // d=1.4 → lejos
      ],
      have,
      remaining,
    )
    const byId = Object.fromEntries(result.map((x) => [x.id, x.goalFit]))
    expect(byId).toEqual({ a: 'dentro', b: 'cerca', c: 'lejos' })
  })

  it('returns null goalFit when there is no goal context (no-goals path)', () => {
    const result = rankSuggestions([r('a', 'A', [['Pollo', 'pollo']], nut(500))], new Set(), null)
    expect(result[0]!.goalFit).toBeNull()
  })

  it('returns null goalFit when the recipe has no nutrition (no-nutrition path)', () => {
    const result = rankSuggestions([r('a', 'A', [['Pollo', 'pollo']], null)], new Set(), remaining)
    expect(result[0]!.goalFit).toBeNull()
  })

  it('handles a remaining target of zero without dividing by zero', () => {
    const result = rankSuggestions(
      [r('a', 'A', [], nut(0)), r('b', 'B', [], nut(300))],
      new Set(),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    )
    // recipe A adds nothing → distance 0 → dentro; B overshoots
    expect(result[0]!.id).toBe('a')
    expect(result[0]!.goalFit).toBe('dentro')
  })

  it('falls back to title when coverage ties and there is no goal to compare', () => {
    const result = rankSuggestions(
      [r('z', 'Zeta', [['Pollo', 'pollo']]), r('a', 'Alfa', [['Pollo', 'pollo']])],
      new Set(['pollo']),
      null,
    )
    expect(result.map((x) => x.title)).toEqual(['Alfa', 'Zeta'])
  })

  it('returns empty for no recipes', () => {
    expect(rankSuggestions([], new Set(), null)).toEqual([])
  })
})
