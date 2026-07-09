import { Vibration } from 'react-native'
import * as Speech from 'expo-speech'
import { notify } from './platformAlert'

export function onStepTimerComplete(): void {
  Vibration.vibrate([0, 400, 200, 400])
  notify('¡Tiempo!', 'El tiempo de este paso ha terminado.')
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
