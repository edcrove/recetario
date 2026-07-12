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
  it('pre-loads paused with the given seconds (tap-to-start)', () => {
    const { result } = renderHook(() => useStepTimer(60))
    expect(result.current.secondsLeft).toBe(60)
    expect(result.current.isRunning).toBe(false)
  })

  it('initializes idle for null duration', () => {
    const { result } = renderHook(() => useStepTimer(null))
    expect(result.current.secondsLeft).toBe(0)
    expect(result.current.isRunning).toBe(false)
  })

  it('counts down each second once started', () => {
    const { result } = renderHook(() => useStepTimer(3))
    expect(result.current.secondsLeft).toBe(3)

    act(() => {
      result.current.toggle()
    })
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
    const { result } = renderHook(() => useStepTimer(3, onComplete))

    act(() => {
      result.current.toggle()
    })
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

  it('tracks the started flag for the Iniciar/Reanudar label', () => {
    const { result } = renderHook(() => useStepTimer(60))
    expect(result.current.started).toBe(false) // shows "Iniciar"

    act(() => {
      result.current.toggle()
    })
    expect(result.current.started).toBe(true) // now "Pausar"/"Reanudar"

    act(() => {
      result.current.reset()
    })
    expect(result.current.started).toBe(false) // back to "Iniciar"
  })

  it('clears started when durationSeconds changes', () => {
    let duration: number | null = 3
    const { result, rerender } = renderHook(() => useStepTimer(duration))
    act(() => {
      result.current.toggle()
    })
    expect(result.current.started).toBe(true)
    duration = 60
    rerender()
    expect(result.current.started).toBe(false)
  })

  it('toggle starts, pauses and resumes', () => {
    const { result } = renderHook(() => useStepTimer(60))
    expect(result.current.isRunning).toBe(false) // tap-to-start: paused initially

    act(() => {
      result.current.toggle()
    })
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

  it('reset returns to the full duration, paused', () => {
    const { result } = renderHook(() => useStepTimer(3))

    act(() => {
      result.current.toggle()
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.secondsLeft).toBe(1)

    act(() => {
      result.current.reset()
    })
    expect(result.current.secondsLeft).toBe(3)
    expect(result.current.isRunning).toBe(false)
  })

  it('resets to paused when durationSeconds changes', () => {
    let duration: number | null = 3
    const { result, rerender } = renderHook(() => useStepTimer(duration))

    act(() => {
      result.current.toggle()
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.secondsLeft).toBe(1)

    duration = 60
    rerender()
    expect(result.current.secondsLeft).toBe(60)
    expect(result.current.isRunning).toBe(false)
  })
})
