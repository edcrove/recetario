import { describe, it, expect } from 'vitest'
import { getWeekStart, addDays, formatDate } from '../utils/weekMath'

describe('getWeekStart', () => {
  it('returns Monday for a Monday', () => {
    expect(getWeekStart(new Date('2026-06-29T12:00:00Z'))).toBe('2026-06-29')
  })

  it('returns previous Monday for a Wednesday', () => {
    expect(getWeekStart(new Date('2026-07-01T12:00:00Z'))).toBe('2026-06-29')
  })

  it('returns previous Monday for a Sunday', () => {
    expect(getWeekStart(new Date('2026-07-05T12:00:00Z'))).toBe('2026-06-29')
  })

  it('returns previous Monday for a Saturday', () => {
    expect(getWeekStart(new Date('2026-07-04T12:00:00Z'))).toBe('2026-06-29')
  })

  it('handles month boundary (Sunday in next month)', () => {
    expect(getWeekStart(new Date('2026-08-02T12:00:00Z'))).toBe('2026-07-27')
  })

  it('handles year boundary (Wednesday Jan 1)', () => {
    expect(getWeekStart(new Date('2025-01-01T12:00:00Z'))).toBe('2024-12-30')
  })

  it('handles leap year Feb 29', () => {
    expect(getWeekStart(new Date('2028-02-29T12:00:00Z'))).toBe('2028-02-28')
  })
})

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2026-06-29', 3)).toBe('2026-07-02')
  })

  it('adds 6 days for week end', () => {
    expect(addDays('2026-06-29', 6)).toBe('2026-07-05')
  })

  it('subtracts days with negative value', () => {
    expect(addDays('2026-07-01', -7)).toBe('2026-06-24')
  })

  it('handles month boundary', () => {
    expect(addDays('2026-01-30', 2)).toBe('2026-02-01')
  })

  it('handles year boundary', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })

  it('adding 0 returns same date', () => {
    expect(addDays('2026-06-15', 0)).toBe('2026-06-15')
  })
})

describe('formatDate', () => {
  it('formats a date in es-AR locale', () => {
    const result = formatDate('2026-06-29')
    expect(result).toMatch(/lun/)
    expect(result).toMatch(/29/)
  })

  it('formats a Sunday', () => {
    const result = formatDate('2026-07-05')
    expect(result).toMatch(/dom/)
  })
})

describe('week math agreement with API getWeek window', () => {
  it('weekStart + 6 days covers exactly 7 days (Mon-Sun)', () => {
    const monday = getWeekStart(new Date('2026-07-01T12:00:00Z'))
    const sunday = addDays(monday, 6)
    expect(monday).toBe('2026-06-29')
    expect(sunday).toBe('2026-07-05')
    const mondayDay = new Date(monday + 'T00:00:00Z').getUTCDay()
    const sundayDay = new Date(sunday + 'T00:00:00Z').getUTCDay()
    expect(mondayDay).toBe(1)
    expect(sundayDay).toBe(0)
  })

  it('consecutive weeks do not overlap', () => {
    const week1Start = getWeekStart(new Date('2026-06-29T12:00:00Z'))
    const week1End = addDays(week1Start, 6)
    const week2Start = addDays(week1Start, 7)
    expect(week1End).toBe('2026-07-05')
    expect(week2Start).toBe('2026-07-06')
    expect(week2Start > week1End).toBe(true)
  })
})
