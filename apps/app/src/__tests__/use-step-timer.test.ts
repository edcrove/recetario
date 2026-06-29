import { describe, it, expect } from 'vitest'
import { timerSeconds, formatTime } from '../hooks/useStepTimer'

describe('timerSeconds', () => {
  it('returns 0 for null duration', () => {
    expect(timerSeconds(null)).toBe(0)
  })
  it('converts minutes to seconds', () => {
    expect(timerSeconds(2)).toBe(120)
    expect(timerSeconds(0.5)).toBe(30)
  })
  it('rounds fractional seconds', () => {
    expect(timerSeconds(0.1)).toBe(6)
  })
  it('clamps negative to 0', () => {
    expect(timerSeconds(-1)).toBe(0)
  })
})

describe('formatTime', () => {
  it('formats zero as 00:00', () => {
    expect(formatTime(0)).toBe('00:00')
  })
  it('pads seconds below 10', () => {
    expect(formatTime(5)).toBe('00:05')
  })
  it('formats 90 seconds as 01:30', () => {
    expect(formatTime(90)).toBe('01:30')
  })
  it('formats large durations', () => {
    expect(formatTime(3600)).toBe('60:00')
  })
  it('pads minutes below 10', () => {
    expect(formatTime(65)).toBe('01:05')
  })
})
