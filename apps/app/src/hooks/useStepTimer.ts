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

export function useStepTimer(durationSeconds: number | null, onComplete?: () => void) {
  const init = initTimer(durationSeconds)
  const [secondsLeft, setSecondsLeft] = useState(init.secondsLeft)
  const [isRunning, setIsRunning] = useState(init.isRunning)
  // Whether the timer has been started since load/reset — drives the
  // Iniciar → Pausar/Reanudar label, independent of elapsed time.
  const [started, setStarted] = useState(false)
  const secondsRef = useRef(init.secondsLeft)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const state = initTimer(durationSeconds)
    secondsRef.current = state.secondsLeft
    completedRef.current = false
    setSecondsLeft(state.secondsLeft)
    setIsRunning(state.isRunning)
    setStarted(false)
  }, [durationSeconds])

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      secondsRef.current = Math.max(0, secondsRef.current - 1)
      setSecondsLeft(secondsRef.current)
      if (secondsRef.current <= 0 && !completedRef.current) {
        completedRef.current = true
        clearInterval(id)
        setIsRunning(false)
        onCompleteRef.current?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const toggle = useCallback(() => {
    setStarted(true)
    setIsRunning((r) => !r)
  }, [])

  const reset = useCallback(() => {
    const state = initTimer(durationSeconds)
    completedRef.current = false
    secondsRef.current = state.secondsLeft
    setSecondsLeft(state.secondsLeft)
    setIsRunning(state.isRunning)
    setStarted(false)
  }, [durationSeconds])

  return { secondsLeft, isRunning, started, toggle, reset }
}
