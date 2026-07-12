import { describe, it, expect } from 'vitest'
import type { Recipe } from '@recetario/shared'
import {
  DIFFICULTIES,
  TIME_FILTERS,
  formatTimeDifficulty,
  matchesTimeDifficulty,
  filterByTimeDifficulty,
} from '../utils/recipeMeta'

type Meta = Pick<Recipe, 'totalTimeMin' | 'difficulty'>
const meta = (totalTimeMin?: number, difficulty?: Recipe['difficulty']): Meta => ({
  totalTimeMin,
  difficulty,
})

describe('constants', () => {
  it('exposes the three difficulties in ascending order', () => {
    expect(DIFFICULTIES).toEqual(['fácil', 'media', 'difícil'])
  })
  it('exposes 20/40/60 max-time filters', () => {
    expect(TIME_FILTERS.map((f) => f.maxTotalTime)).toEqual([20, 40, 60])
  })
})

describe('formatTimeDifficulty', () => {
  it('shows both time and difficulty', () => {
    expect(formatTimeDifficulty(meta(25, 'fácil'))).toBe('⏱ 25 min · fácil')
  })
  it('shows only time when difficulty absent', () => {
    expect(formatTimeDifficulty(meta(25, undefined))).toBe('⏱ 25 min')
  })
  it('shows only difficulty when time absent', () => {
    expect(formatTimeDifficulty(meta(undefined, 'difícil'))).toBe('difícil')
  })
  it('returns empty string when both absent', () => {
    expect(formatTimeDifficulty(meta(undefined, undefined))).toBe('')
  })
})

describe('matchesTimeDifficulty', () => {
  it('passes when no filter is set', () => {
    expect(matchesTimeDifficulty(meta(90, 'difícil'), {})).toBe(true)
  })
  it('includes a recipe within the max-time cap', () => {
    expect(matchesTimeDifficulty(meta(20, undefined), { maxTotalTime: 20 })).toBe(true)
  })
  it('excludes a recipe over the max-time cap', () => {
    expect(matchesTimeDifficulty(meta(21, undefined), { maxTotalTime: 20 })).toBe(false)
  })
  it('excludes a recipe with unknown total when a cap is active', () => {
    expect(matchesTimeDifficulty(meta(undefined, 'fácil'), { maxTotalTime: 30 })).toBe(false)
  })
  it('matches difficulty exactly', () => {
    expect(matchesTimeDifficulty(meta(10, 'media'), { difficulty: 'media' })).toBe(true)
    expect(matchesTimeDifficulty(meta(10, 'fácil'), { difficulty: 'media' })).toBe(false)
  })
  it('excludes a recipe with no difficulty when a difficulty filter is active', () => {
    expect(matchesTimeDifficulty(meta(10, undefined), { difficulty: 'fácil' })).toBe(false)
  })
  it('requires both conditions when both filters are set', () => {
    expect(
      matchesTimeDifficulty(meta(15, 'fácil'), { maxTotalTime: 20, difficulty: 'fácil' }),
    ).toBe(true)
    expect(
      matchesTimeDifficulty(meta(15, 'media'), { maxTotalTime: 20, difficulty: 'fácil' }),
    ).toBe(false)
  })
})

describe('filterByTimeDifficulty', () => {
  const recipes = [meta(15, 'fácil'), meta(45, 'media'), meta(undefined, 'difícil')]
  it('returns the same array reference when no filter set', () => {
    expect(filterByTimeDifficulty(recipes, {})).toBe(recipes)
  })
  it('filters by max time', () => {
    expect(filterByTimeDifficulty(recipes, { maxTotalTime: 20 })).toEqual([meta(15, 'fácil')])
  })
  it('filters by difficulty', () => {
    expect(filterByTimeDifficulty(recipes, { difficulty: 'media' })).toEqual([meta(45, 'media')])
  })
})
