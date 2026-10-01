import { describe, it, expect } from 'vitest'
import {
  chartWeeks,
  streakLabel,
  topRecipeLabel,
  statsWindowLabel,
  weekLabel,
} from '../utils/statsLabels'

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

// Story "App: pantalla de stats y tendencias": "streak de días consecutivos
// cocinando" and "gráfico de barras de frecuencia por semana (mínimo 8 semanas)".
describe('streakLabel', () => {
  it('singular for one day, plural otherwise', () => {
    expect(streakLabel(1)).toBe('1 día seguido')
    expect(streakLabel(2)).toBe('2 días seguidos')
    expect(streakLabel(12)).toBe('12 días seguidos')
  })
})

describe('chartWeeks', () => {
  const current = '2026-09-28' // a Monday

  it('always spans at least 8 weeks ending on the current one, empty weeks as 0', () => {
    const weeks = chartWeeks([{ week: '2026-09-21', count: 3 }], current)
    expect(weeks).toHaveLength(8)
    expect(weeks[0]).toEqual({ week: '2026-08-10', count: 0 })
    expect(weeks[6]).toEqual({ week: '2026-09-21', count: 3 })
    expect(weeks[7]).toEqual({ week: '2026-09-28', count: 0 })
  })

  it('reaches further back when the data starts earlier (90-day window ≈ 13 weeks)', () => {
    const weeks = chartWeeks(
      [
        { week: '2026-07-06', count: 1 },
        { week: '2026-09-28', count: 2 },
      ],
      current,
    )
    expect(weeks[0]).toEqual({ week: '2026-07-06', count: 1 })
    expect(weeks.at(-1)).toEqual({ week: '2026-09-28', count: 2 })
    expect(weeks).toHaveLength(13)
  })

  it('keeps consecutive weeks 7 days apart (gaps read as gaps)', () => {
    const weeks = chartWeeks([], current)
    for (let i = 1; i < weeks.length; i++) {
      expect(new Date(weeks[i]!.week).getTime() - new Date(weeks[i - 1]!.week).getTime()).toBe(
        7 * 24 * 60 * 60 * 1000,
      )
    }
  })

  it('honours a custom minimum', () => {
    expect(chartWeeks([], current, 4)).toHaveLength(4)
    expect(chartWeeks([], current, 1)).toEqual([{ week: current, count: 0 }])
  })
})

describe('weekLabel', () => {
  it("shows the week's Monday, never the Sunday before (UTC-3)", () => {
    expect(weekLabel('2026-09-28')).toMatch(/^28 sept?/)
    expect(weekLabel('2026-03-02')).toMatch(/^2 mar/)
  })
})
