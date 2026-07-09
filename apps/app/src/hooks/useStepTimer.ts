import { useState, useEffect, useRef, useCallback } from 'react'

export function timerSeconds(durationMin: number | null): number {
  return durationMin != null ? Math.max(0, Math.round(durationMin * 60)) : 0
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

export function initTimer(durationMin: number | null): TimerState {
  const secs = timerSeconds(durationMin)
  return { secondsLeft: secs, isRunning: secs > 0, completed: false }
}

export function useStepTimer(durationMin: number | null, onComplete?: () => void) {
  const init = initTimer(durationMin)
  const [secondsLeft, setSecondsLeft] = useState(init.secondsLeft)
  const [isRunning, setIsRunning] = useState(init.isRunning)
  const secondsRef = useRef(init.secondsLeft)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const state = initTimer(durationMin)
    secondsRef.current = state.secondsLeft
    completedRef.current = false
    setSecondsLeft(state.secondsLeft)
    setIsRunning(state.isRunning)
  }, [durationMin])

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

  const toggle = useCallback(() => setIsRunning((r) => !r), [])

  const reset = useCallback(() => {
    const state = initTimer(durationMin)
    completedRef.current = false
    secondsRef.current = state.secondsLeft
    setSecondsLeft(state.secondsLeft)
    setIsRunning(state.isRunning)
  }, [durationMin])

  return { secondsLeft, isRunning, toggle, reset }
}
