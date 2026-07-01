import { describe, it, expect, vi, beforeEach } from 'vitest'

// Tests for the native (non-web) branch of authStorage
// Uses Platform.OS = 'ios' to exercise the SecureStore path

vi.mock('react-native', async () => {
  const actual = await vi.importActual<typeof import('../__mocks__/react-native')>(
    '../__mocks__/react-native',
  )
  return { ...actual, Platform: { OS: 'ios' } }
})

const mockGetItemAsync = vi.fn()
const mockSetItemAsync = vi.fn()
const mockDeleteItemAsync = vi.fn()

vi.mock('expo-secure-store', () => ({
  getItemAsync: mockGetItemAsync,
  setItemAsync: mockSetItemAsync,
  deleteItemAsync: mockDeleteItemAsync,
}))

describe('authStorage — native platform (ios)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('get delegates to SecureStore.getItemAsync', async () => {
    mockGetItemAsync.mockResolvedValue('native-token')
    const { authStorage } = await import('../utils/authStorage')
    const result = await authStorage.get('auth_token')
    expect(result).toBe('native-token')
    expect(mockGetItemAsync).toHaveBeenCalledWith('auth_token')
  })

  it('set delegates to SecureStore.setItemAsync', async () => {
    mockSetItemAsync.mockResolvedValue(undefined)
    const { authStorage } = await import('../utils/authStorage')
    await authStorage.set('auth_token', 'tok-123')
    expect(mockSetItemAsync).toHaveBeenCalledWith('auth_token', 'tok-123')
  })

  it('del delegates to SecureStore.deleteItemAsync', async () => {
    mockDeleteItemAsync.mockResolvedValue(undefined)
    const { authStorage } = await import('../utils/authStorage')
    await authStorage.del('auth_token')
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('auth_token')
  })
})
