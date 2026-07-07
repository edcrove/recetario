// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAlert = vi.fn()

vi.mock('react-native', () => ({
  Alert: { alert: mockAlert },
  Platform: { OS: 'ios' },
}))

describe('platformAlert — native (ios)', () => {
  beforeEach(() => {
    mockAlert.mockReset()
    vi.resetModules()
  })

  it('confirmAsync resolves true when Confirmar is pressed', async () => {
    mockAlert.mockImplementation((_title, _msg, buttons) => {
      const confirmBtn = buttons.find((b: { text: string }) => b.text === 'Confirmar')
      confirmBtn.onPress()
    })
    const { confirmAsync } = await import('../utils/platformAlert')
    const result = await confirmAsync('Título', 'Mensaje')
    expect(result).toBe(true)
  })

  it('confirmAsync resolves false when Cancelar is pressed', async () => {
    mockAlert.mockImplementation((_title, _msg, buttons) => {
      const cancelBtn = buttons.find((b: { text: string }) => b.text === 'Cancelar')
      cancelBtn.onPress()
    })
    const { confirmAsync } = await import('../utils/platformAlert')
    const result = await confirmAsync('Título', 'Mensaje')
    expect(result).toBe(false)
  })

  it('notify calls Alert.alert with title and message', async () => {
    const { notify } = await import('../utils/platformAlert')
    notify('Título', 'Mensaje')
    expect(mockAlert).toHaveBeenCalledWith('Título', 'Mensaje')
  })
})

describe('platformAlert — web', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('confirmAsync uses window.confirm on web', async () => {
    vi.doMock('react-native', () => ({
      Alert: { alert: mockAlert },
      Platform: { OS: 'web' },
    }))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { confirmAsync } = await import('../utils/platformAlert')
    const result = await confirmAsync('Título', 'Mensaje')
    expect(result).toBe(true)
    expect(confirmSpy).toHaveBeenCalledWith('Título\n\nMensaje')
    expect(mockAlert).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('notify uses window.alert on web', async () => {
    vi.doMock('react-native', () => ({
      Alert: { alert: mockAlert },
      Platform: { OS: 'web' },
    }))
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { notify } = await import('../utils/platformAlert')
    notify('Título', 'Mensaje')
    expect(alertSpy).toHaveBeenCalledWith('Título\n\nMensaje')
    expect(mockAlert).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })
})
