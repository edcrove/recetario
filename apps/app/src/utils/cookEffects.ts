import { Platform, Vibration } from 'react-native'
import * as Speech from 'expo-speech'

/** What the cook hears and reads when a step timer hits 0:00 (step is 0-based). */
export function timerDoneMessage(stepIndex: number): string {
  return `¡Tiempo! Terminó el paso ${stepIndex + 1}.`
}

type AudioContextCtor = new () => {
  currentTime: number
  destination: unknown
  createOscillator(): {
    type: string
    frequency: { value: number }
    connect(node: unknown): void
    start(when?: number): void
    stop(when?: number): void
  }
  createGain(): {
    gain: { value: number }
    connect(node: unknown): void
  }
}

/**
 * Two short beeps through the Web Audio API. Returns whether they were
 * scheduled: native has no AudioContext and some browsers block or lack it,
 * so the spoken announcement stays as the audible fallback.
 */
export function playChime(): boolean {
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  const Ctor = g.AudioContext ?? g.webkitAudioContext
  if (Platform.OS !== 'web' || !Ctor) return false
  try {
    const ctx = new Ctor()
    const gain = ctx.createGain()
    gain.gain.value = 0.3
    gain.connect(ctx.destination)
    for (const offset of [0, 0.35]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 880
      osc.connect(gain)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.25)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Audible + tactile cue for a finished step timer. The visible cue is the
 * cook screen's banner: a blocking window.alert would freeze every other
 * running timer on web until dismissed.
 */
export function onStepTimerComplete(stepIndex: number): void {
  Vibration.vibrate([0, 400, 200, 400])
  playChime()
  try {
    Speech.speak(timerDoneMessage(stepIndex), { language: 'es' })
  } catch {
    // No speech engine (headless browser): the chime and banner still fire.
  }
}

/**
 * Returns whether speech actually started. Headless/older browsers don't
 * implement the Web Speech API, and expo-speech's web backend then throws
 * synchronously — without the guard the speaker button dies silently (same
 * class of bug as the Alert.alert web no-op documented in CLAUDE.md).
 */
export function startSpeech(
  text: string,
  onDone: () => void,
  onStopped: () => void,
  onError: () => void,
): boolean {
  try {
    Speech.speak(text, { language: 'es', onDone, onStopped, onError })
    return true
  } catch {
    return false
  }
}

export function stopSpeech(): void {
  void Speech.stop()
}
