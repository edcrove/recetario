import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react-native', () => ({
  Vibration: { vibrate: vi.fn() },
  Alert: { alert: vi.fn() },
}))

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
}))

import { onStepTimerComplete, startSpeech, stopSpeech } from '../utils/cookEffects'
import { Vibration, Alert } from 'react-native'
import * as Speech from 'expo-speech'

const mockVibrate = vi.mocked(Vibration.vibrate)
const mockAlert = vi.mocked(Alert.alert)
const mockSpeak = vi.mocked(Speech.speak)
const mockStop = vi.mocked(Speech.stop)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('onStepTimerComplete', () => {
  it('vibrates with the correct pattern', () => {
    onStepTimerComplete()
    expect(mockVibrate).toHaveBeenCalledWith([0, 400, 200, 400])
  })

  it('shows alert with correct title and message', () => {
    onStepTimerComplete()
    expect(mockAlert).toHaveBeenCalledWith('¡Tiempo!', 'El tiempo de este paso ha terminado.')
  })

  it('fires both vibration and alert', () => {
    onStepTimerComplete()
    expect(mockVibrate).toHaveBeenCalledTimes(1)
    expect(mockAlert).toHaveBeenCalledTimes(1)
  })
})

describe('startSpeech', () => {
  it('calls Speech.speak with Spanish language', () => {
    const onDone = vi.fn()
    startSpeech('Mezclar bien', onDone, vi.fn(), vi.fn())
    expect(mockSpeak).toHaveBeenCalledWith(
      'Mezclar bien',
      expect.objectContaining({ language: 'es' }),
    )
  })

  it('passes callbacks to Speech.speak options', () => {
    const onDone = vi.fn()
    const onStopped = vi.fn()
    const onError = vi.fn()
    startSpeech('Texto', onDone, onStopped, onError)
    const options = mockSpeak.mock.calls[0]?.[1] as {
      onDone: () => void
      onStopped: () => void
      onError: () => void
    }
    options.onDone()
    expect(onDone).toHaveBeenCalled()
    options.onStopped()
    expect(onStopped).toHaveBeenCalled()
    options.onError()
    expect(onError).toHaveBeenCalled()
  })
})

describe('stopSpeech', () => {
  it('calls Speech.stop', () => {
    stopSpeech()
    expect(mockStop).toHaveBeenCalledTimes(1)
  })
})
