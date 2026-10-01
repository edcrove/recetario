import { useState, useEffect, useRef, useCallback } from 'react'

/** Clamps/rounds an incoming seconds value; null → 0. */
export function timerSeconds(durationSeconds: number | null): number {
  return durationSeconds != null ? Math.max(0, Math.round(durationSeconds)) : 0
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export interface TimerState {
  secondsLeft: number
  isRunning: boolean
  completed: boolean
}

/**
 * Pre-loads a step timer but does NOT auto-start it — the cook taps to start
 * (tap-to-start). `secondsLeft` is the parsed/auto-detected step duration.
 */
export function initTimer(durationSeconds: number | null): TimerState {
  const secs = timerSeconds(durationSeconds)
  return { secondsLeft: secs, isRunning: false, completed: false }
}

interface StepTimer {
  /** Absolute deadline while running; null while paused/idle. */
  endsAt: number | null
  /** Time left while paused. */
  remainingMs: number
  started: boolean
}

export interface StepTimerView {
  secondsLeft: number
  isRunning: boolean
  started: boolean
}

/**
 * Cook-mode timers, one per step and keyed by the step index (not its duration),
 * so a running timer keeps going while the cook moves between steps. Each timer
 * stores an absolute `endsAt`, so a throttled/backgrounded tab still shows the
 * right time when it wakes up; the interval only drives re-renders.
 */
export function useCookTimers(onComplete?: (stepIndex: number) => void) {
  const [timers, setTimers] = useState<Record<number, StepTimer>>({})
  const [, setTick] = useState(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const anyRunning = Object.values(timers).some((t) => t.endsAt !== null)

  useEffect(() => {
    if (!anyRunning) return
    const id = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [anyRunning])

  const now = Date.now()
  const finished = Object.entries(timers)
    .filter(([, t]) => t.endsAt !== null && t.endsAt <= now)
    .map(([step]) => Number(step))

  useEffect(() => {
    if (finished.length === 0) return
    setTimers((prev) => {
      const next = { ...prev }
      for (const step of finished) next[step] = { endsAt: null, remainingMs: 0, started: true }
      return next
    })
    for (const step of finished) onCompleteRef.current?.(step)
    // `finished` is derived from timers + the tick; its content is the dependency.
  }, [finished.join(',')])

  const view = (step: number, durationSeconds: number | null): StepTimerView => {
    const t = timers[step]
    if (!t) return { secondsLeft: timerSeconds(durationSeconds), isRunning: false, started: false }
    const ms = t.endsAt !== null ? Math.max(0, t.endsAt - now) : t.remainingMs
    return { secondsLeft: Math.ceil(ms / 1000), isRunning: t.endsAt !== null, started: t.started }
  }

  const toggle = useCallback((step: number, durationSeconds: number | null) => {
    setTimers((prev) => {
      const t = prev[step] ?? {
        endsAt: null,
        remainingMs: timerSeconds(durationSeconds) * 1000,
        started: false,
      }
      if (t.endsAt !== null) {
        return { ...prev, [step]: { ...t, endsAt: null, remainingMs: t.endsAt - Date.now() } }
      }
      if (t.remainingMs <= 0) return prev
      return { ...prev, [step]: { ...t, endsAt: Date.now() + t.remainingMs, started: true } }
    })
  }, [])

  const reset = useCallback((step: number) => {
    setTimers((prev) => {
      const next = { ...prev }
      delete next[step]
      return next
    })
  }, [])

  const running = Object.entries(timers)
    .filter(([, t]) => t.endsAt !== null)
    .map(([step, t]) => ({
      step: Number(step),
      secondsLeft: Math.ceil(Math.max(0, (t.endsAt as number) - now) / 1000),
    }))
    .sort((a, b) => a.step - b.step)

  return { view, toggle, reset, running }
}
