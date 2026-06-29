import { describe, it, expect } from 'vitest'
import {
  timerSeconds,
  formatTime,
  initTimer,
  tickTimer,
  toggleTimer,
  resetTimer,
} from '../hooks/useStepTimer'

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

describe('initTimer', () => {
  it('starts running with positive duration', () => {
    const state = initTimer(1)
    expect(state).toEqual({ secondsLeft: 60, isRunning: true, completed: false })
  })

  it('starts idle for null duration', () => {
    const state = initTimer(null)
    expect(state).toEqual({ secondsLeft: 0, isRunning: false, completed: false })
  })

  it('starts idle for zero duration', () => {
    const state = initTimer(0)
    expect(state).toEqual({ secondsLeft: 0, isRunning: false, completed: false })
  })
})

describe('tickTimer', () => {
  it('decrements secondsLeft by 1', () => {
    const state = initTimer(1)
    const next = tickTimer(state)
    expect(next.secondsLeft).toBe(59)
    expect(next.isRunning).toBe(true)
    expect(next.completed).toBe(false)
  })

  it('completes when reaching 0', () => {
    const state = { secondsLeft: 1, isRunning: true, completed: false }
    const next = tickTimer(state)
    expect(next.secondsLeft).toBe(0)
    expect(next.isRunning).toBe(false)
    expect(next.completed).toBe(true)
  })

  it('does not tick when paused', () => {
    const state = { secondsLeft: 30, isRunning: false, completed: false }
    expect(tickTimer(state)).toBe(state)
  })

  it('does not tick when already completed', () => {
    const state = { secondsLeft: 0, isRunning: false, completed: true }
    expect(tickTimer(state)).toBe(state)
  })

  it('counts down correctly through multiple ticks', () => {
    let state = initTimer(0.05) // 3 seconds
    const ticks: number[] = []
    while (state.isRunning) {
      state = tickTimer(state)
      ticks.push(state.secondsLeft)
    }
    expect(ticks).toEqual([2, 1, 0])
    expect(state.completed).toBe(true)
  })

  it('fires completion exactly once (idempotent after complete)', () => {
    const state = { secondsLeft: 0, isRunning: false, completed: true }
    const next = tickTimer(state)
    expect(next).toBe(state)
  })
})

describe('toggleTimer', () => {
  it('pauses a running timer', () => {
    const state = { secondsLeft: 30, isRunning: true, completed: false }
    const paused = toggleTimer(state)
    expect(paused.isRunning).toBe(false)
    expect(paused.secondsLeft).toBe(30)
  })

  it('resumes a paused timer', () => {
    const state = { secondsLeft: 30, isRunning: false, completed: false }
    const resumed = toggleTimer(state)
    expect(resumed.isRunning).toBe(true)
  })

  it('does not toggle a completed timer', () => {
    const state = { secondsLeft: 0, isRunning: false, completed: true }
    expect(toggleTimer(state)).toBe(state)
  })
})

describe('resetTimer', () => {
  it('resets to initial state for given duration', () => {
    const state = resetTimer(2)
    expect(state).toEqual({ secondsLeft: 120, isRunning: true, completed: false })
  })

  it('resets to idle for null duration', () => {
    const state = resetTimer(null)
    expect(state).toEqual({ secondsLeft: 0, isRunning: false, completed: false })
  })
})
