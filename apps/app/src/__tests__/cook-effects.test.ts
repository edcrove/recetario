import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const platform = vi.hoisted(() => ({ OS: 'web' }))
vi.mock('react-native', () => ({
  Vibration: { vibrate: vi.fn() },
  Alert: { alert: vi.fn() },
  Platform: platform,
}))

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
}))

import {
  onStepTimerComplete,
  playChime,
  startSpeech,
  stopSpeech,
  timerDoneMessage,
} from '../utils/cookEffects'
import { Vibration, Alert } from 'react-native'
import * as Speech from 'expo-speech'

const mockVibrate = vi.mocked(Vibration.vibrate)
const mockAlert = vi.mocked(Alert.alert)
const mockSpeak = vi.mocked(Speech.speak)
const mockStop = vi.mocked(Speech.stop)

// Records every oscillator the chime schedules, so a test can assert what the
// cook hears rather than that "something" ran.
interface FakeOsc {
  type: string
  frequency: { value: number }
  connect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}
let oscillators: FakeOsc[] = []
let gains: { gain: { value: number }; connect: ReturnType<typeof vi.fn> }[] = []
class FakeAudioContext {
  currentTime = 10
  destination = { kind: 'speakers' }
  createOscillator() {
    const o: FakeOsc = {
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    oscillators.push(o)
    return o
  }
  createGain() {
    const g = { gain: { value: 1 }, connect: vi.fn() }
    gains.push(g)
    return g
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  platform.OS = 'web'
  oscillators = []
  gains = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('timerDoneMessage', () => {
  it('names the finished step 1-based', () => {
    expect(timerDoneMessage(0)).toBe('¡Tiempo! Terminó el paso 1.')
    expect(timerDoneMessage(3)).toBe('¡Tiempo! Terminó el paso 4.')
  })
})

describe('playChime (audible cue on web)', () => {
  it('schedules two audible 880 Hz beeps through the speakers', () => {
    expect(playChime()).toBe(true)
    expect(oscillators).toHaveLength(2)
    for (const o of oscillators) {
      expect(o.type).toBe('sine')
      expect(o.frequency.value).toBe(880)
      expect(o.connect).toHaveBeenCalledWith(gains[0])
    }
    expect(gains[0]!.gain.value).toBeGreaterThan(0)
    expect(gains[0]!.connect).toHaveBeenCalledWith({ kind: 'speakers' })
  })

  it('plays the beeps one after the other, each one short', () => {
    playChime()
    const [a, b] = oscillators as [FakeOsc, FakeOsc]
    expect(a.start).toHaveBeenCalledWith(10)
    expect(a.stop).toHaveBeenCalledWith(10.25)
    expect(b.start).toHaveBeenCalledWith(10.35)
    expect(b.stop).toHaveBeenCalledWith(10.6)
  })

  it('falls back to the prefixed webkitAudioContext (older Safari)', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', FakeAudioContext)
    expect(playChime()).toBe(true)
    expect(oscillators).toHaveLength(2)
  })

  it('returns false without Web Audio instead of throwing', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(playChime()).toBe(false)
  })

  it('returns false when the browser refuses to create the context', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('NotAllowedError')
        }
      },
    )
    expect(playChime()).toBe(false)
  })

  it('does nothing on native (no Web Audio there)', () => {
    platform.OS = 'ios'
    expect(playChime()).toBe(false)
    expect(oscillators).toHaveLength(0)
  })
})

describe('onStepTimerComplete (AC: audible notification at 0:00)', () => {
  it('beeps, announces the finished step in Spanish and vibrates', () => {
    onStepTimerComplete(2)
    expect(oscillators).toHaveLength(2)
    expect(mockSpeak).toHaveBeenCalledWith('¡Tiempo! Terminó el paso 3.', { language: 'es' })
    expect(mockVibrate).toHaveBeenCalledWith([0, 400, 200, 400])
  })

  it('never opens a blocking alert (it would freeze the other timers on web)', () => {
    onStepTimerComplete(0)
    expect(mockAlert).not.toHaveBeenCalled()
  })

  it('still beeps and vibrates when no speech engine is available', () => {
    mockSpeak.mockImplementationOnce(() => {
      throw new Error('speechSynthesis is not defined')
    })
    expect(() => onStepTimerComplete(0)).not.toThrow()
    expect(oscillators).toHaveLength(2)
    expect(mockVibrate).toHaveBeenCalledTimes(1)
  })

  it('on native the spoken announcement is the audible cue', () => {
    platform.OS = 'android'
    onStepTimerComplete(1)
    expect(oscillators).toHaveLength(0)
    expect(mockSpeak).toHaveBeenCalledWith('¡Tiempo! Terminó el paso 2.', { language: 'es' })
    expect(mockVibrate).toHaveBeenCalledTimes(1)
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

  it('returns true when speak succeeds', () => {
    expect(startSpeech('Texto', vi.fn(), vi.fn(), vi.fn())).toBe(true)
  })

  it('returns false when speak throws (Web Speech API unavailable)', () => {
    mockSpeak.mockImplementationOnce(() => {
      throw new Error('speechSynthesis is not defined')
    })
    expect(startSpeech('Texto', vi.fn(), vi.fn(), vi.fn())).toBe(false)
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
