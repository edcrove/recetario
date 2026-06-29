// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStepTimer } from '../hooks/useStepTimer'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useStepTimer hook', () => {
  it('initializes with correct seconds and running state', () => {
    const { result } = renderHook(() => useStepTimer(1))
    expect(result.current.secondsLeft).toBe(60)
    expect(result.current.isRunning).toBe(true)
  })

  it('initializes idle for null duration', () => {
    const { result } = renderHook(() => useStepTimer(null))
    expect(result.current.secondsLeft).toBe(0)
    expect(result.current.isRunning).toBe(false)
  })

  it('counts down each second', () => {
    const { result } = renderHook(() => useStepTimer(0.05))
    expect(result.current.secondsLeft).toBe(3)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.secondsLeft).toBe(2)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.secondsLeft).toBe(1)
  })

  it('fires onComplete exactly once when reaching 0', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useStepTimer(0.05, onComplete))

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.secondsLeft).toBe(0)
    expect(result.current.isRunning).toBe(false)
    expect(onComplete).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('toggle pauses and resumes', () => {
    const { result } = renderHook(() => useStepTimer(1))
    expect(result.current.isRunning).toBe(true)

    act(() => {
      result.current.toggle()
    })
    expect(result.current.isRunning).toBe(false)

    const frozenSeconds = result.current.secondsLeft
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.secondsLeft).toBe(frozenSeconds)

    act(() => {
      result.current.toggle()
    })
    expect(result.current.isRunning).toBe(true)
  })

  it('reset restarts the timer', () => {
    const { result } = renderHook(() => useStepTimer(0.05))

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.secondsLeft).toBe(1)

    act(() => {
      result.current.reset()
    })
    expect(result.current.secondsLeft).toBe(3)
    expect(result.current.isRunning).toBe(true)
  })

  it('resets when durationMin changes', () => {
    let duration: number | null = 0.05
    const { result, rerender } = renderHook(() => useStepTimer(duration))

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.secondsLeft).toBe(1)

    duration = 1
    rerender()
    expect(result.current.secondsLeft).toBe(60)
    expect(result.current.isRunning).toBe(true)
  })
})
