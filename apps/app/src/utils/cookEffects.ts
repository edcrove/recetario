import { Vibration } from 'react-native'
import * as Speech from 'expo-speech'
import { notify } from './platformAlert'

export function onStepTimerComplete(): void {
  Vibration.vibrate([0, 400, 200, 400])
  notify('¡Tiempo!', 'El tiempo de este paso ha terminado.')
}

export function startSpeech(
  text: string,
  onDone: () => void,
  onStopped: () => void,
  onError: () => void,
): void {
  Speech.speak(text, { language: 'es', onDone, onStopped, onError })
}

export function stopSpeech(): void {
  void Speech.stop()
}
