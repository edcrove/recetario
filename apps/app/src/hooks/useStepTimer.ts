import { useState, useEffect, useRef, useCallback } from 'react'

export function timerSeconds(durationMin: number | null): number {
  return durationMin != null ? Math.max(0, Math.round(durationMin * 60)) : 0
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function useStepTimer(durationMin: number | null, onComplete?: () => void) {
  const total = timerSeconds(durationMin)
  const [secondsLeft, setSecondsLeft] = useState(total)
  const [isRunning, setIsRunning] = useState(total > 0)
  const secondsRef = useRef(total)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const secs = timerSeconds(durationMin)
    secondsRef.current = secs
    completedRef.current = false
    setSecondsLeft(secs)
    setIsRunning(secs > 0)
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
    const secs = timerSeconds(durationMin)
    completedRef.current = false
    secondsRef.current = secs
    setSecondsLeft(secs)
    setIsRunning(secs > 0)
  }, [durationMin])

  return { secondsLeft, isRunning, toggle, reset }
}
