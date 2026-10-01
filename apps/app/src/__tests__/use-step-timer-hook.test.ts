// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCookTimers } from '../hooks/useStepTimer'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCookTimers', () => {
  it('pre-loads each step paused with its full duration (tap-to-start)', () => {
    const { result } = renderHook(() => useCookTimers())
    expect(result.current.view(0, 60)).toEqual({
      secondsLeft: 60,
      isRunning: false,
      started: false,
    })
    expect(result.current.view(1, null)).toEqual({
      secondsLeft: 0,
      isRunning: false,
      started: false,
    })
    expect(result.current.running).toEqual([])
  })

  it('counts down from an absolute deadline once started', () => {
    const { result } = renderHook(() => useCookTimers())
    act(() => result.current.toggle(0, 3))
    expect(result.current.view(0, 3)).toMatchObject({ isRunning: true, started: true })

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.view(0, 3).secondsLeft).toBe(2)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.view(0, 3).secondsLeft).toBe(1)
  })

  it('stays correct when the interval is throttled (backgrounded tab)', () => {
    const { result } = renderHook(() => useCookTimers())
    act(() => result.current.toggle(0, 120))
    // Wall clock jumps 90s without any interval ticks firing.
    vi.setSystemTime(Date.now() + 90_000)
    act(() => vi.advanceTimersByTime(250))
    expect(result.current.view(0, 120).secondsLeft).toBe(30)
  })

  it('pauses and resumes keeping the remaining time', () => {
    const { result } = renderHook(() => useCookTimers())
    act(() => result.current.toggle(0, 10))
    act(() => vi.advanceTimersByTime(4000))
    act(() => result.current.toggle(0, 10))
    expect(result.current.view(0, 10)).toEqual({ secondsLeft: 6, isRunning: false, started: true })

    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.view(0, 10).secondsLeft).toBe(6)

    act(() => result.current.toggle(0, 10))
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.view(0, 10).secondsLeft).toBe(4)
  })

  it('keeps a running timer going while another step is viewed, and lists it', () => {
    const { result } = renderHook(() => useCookTimers())
    act(() => result.current.toggle(1, 300))
    act(() => vi.advanceTimersByTime(60_000))

    // A different step with the same duration starts fresh — timers are keyed by step.
    expect(result.current.view(2, 300)).toEqual({
      secondsLeft: 300,
      isRunning: false,
      started: false,
    })
    expect(result.current.running).toEqual([{ step: 1, secondsLeft: 240 }])
  })

  it('fires onComplete once per step at zero and stops', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useCookTimers(onComplete))
    act(() => result.current.toggle(0, 2))
    act(() => vi.advanceTimersByTime(2250))

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(0)
    expect(result.current.view(0, 2)).toEqual({ secondsLeft: 0, isRunning: false, started: true })
    expect(result.current.running).toEqual([])

    act(() => vi.advanceTimersByTime(5000))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('does not restart a finished timer until it is reset', () => {
    const { result } = renderHook(() => useCookTimers())
    act(() => result.current.toggle(0, 1))
    act(() => vi.advanceTimersByTime(1250))
    act(() => result.current.toggle(0, 1))
    expect(result.current.view(0, 1).isRunning).toBe(false)

    act(() => result.current.reset(0))
    expect(result.current.view(0, 1)).toEqual({ secondsLeft: 1, isRunning: false, started: false })
  })

  it('works without an onComplete callback', () => {
    const { result } = renderHook(() => useCookTimers())
    act(() => result.current.toggle(0, 1))
    act(() => vi.advanceTimersByTime(1250))
    expect(result.current.view(0, 1).secondsLeft).toBe(0)
  })
})
