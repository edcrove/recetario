import { describe, it, expect } from 'vitest'
import { addDays, cookingStreak } from './cookStreak'

// Story "App: pantalla de stats y tendencias": "streak de días consecutivos cocinando".
describe('cookingStreak', () => {
  const today = '2026-10-01'

  it('no cooking → no streak', () => {
    expect(cookingStreak([], today)).toEqual({ current: 0, longest: 0 })
  })

  it('counts consecutive days ending today', () => {
    expect(cookingStreak(['2026-09-29', '2026-09-30', '2026-10-01'], today)).toEqual({
      current: 3,
      longest: 3,
    })
  })

  it('a streak that reached yesterday is still alive today', () => {
    expect(cookingStreak(['2026-09-29', '2026-09-30'], today).current).toBe(2)
  })

  it('a whole day without cooking breaks it', () => {
    expect(cookingStreak(['2026-09-28', '2026-09-29'], today).current).toBe(0)
  })

  it('a gap inside the history splits runs; longest keeps the best one', () => {
    const days = [
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04', // run of 4
      '2026-09-20', // run of 1
      '2026-09-30',
      '2026-10-01', // current run of 2
    ]
    expect(cookingStreak(days, today)).toEqual({ current: 2, longest: 4 })
  })

  it('order and duplicates do not matter (several cooks on one day count once)', () => {
    expect(cookingStreak(['2026-10-01', '2026-09-30', '2026-10-01', '2026-09-30'], today)).toEqual({
      current: 2,
      longest: 2,
    })
  })

  it('crosses month and year boundaries', () => {
    expect(cookingStreak(['2025-12-31', '2026-01-01'], '2026-01-01').current).toBe(2)
    expect(cookingStreak(['2026-02-28', '2026-03-01'], '2026-03-01').current).toBe(2)
    expect(cookingStreak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01').current).toBe(3)
  })

  it('a single day today is a streak of 1', () => {
    expect(cookingStreak([today], today)).toEqual({ current: 1, longest: 1 })
  })

  it('cooking only in the future (clock skew) does not create a current streak', () => {
    expect(cookingStreak(['2026-10-05'], today)).toEqual({ current: 0, longest: 1 })
  })
})

describe('addDays', () => {
  it('moves across months, years and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-01', 0)).toBe('2026-10-01')
  })

  it('ignores DST changes (calendar days, not 24h blocks)', () => {
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })
})
