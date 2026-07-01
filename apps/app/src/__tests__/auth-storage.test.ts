// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// regression: bug 405 — expo-secure-store is a no-op on web (ExpoSecureStore.web.js exports {})
// authStorage must use localStorage when Platform.OS === 'web'

vi.mock('react-native', async () => {
  const actual = await vi.importActual<typeof import('../__mocks__/react-native')>(
    '../__mocks__/react-native',
  )
  return { ...actual, Platform: { OS: 'web' } }
})

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}))

const TOKEN_KEY = 'auth_token'

describe('authStorage — web platform', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('get returns null when localStorage is empty', async () => {
    const { authStorage } = await import('../utils/authStorage')
    expect(await authStorage.get(TOKEN_KEY)).toBeNull()
  })

  it('set stores value in localStorage', async () => {
    const { authStorage } = await import('../utils/authStorage')
    await authStorage.set(TOKEN_KEY, 'jwt-abc')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-abc')
  })

  it('get retrieves value from localStorage', async () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-xyz')
    const { authStorage } = await import('../utils/authStorage')
    expect(await authStorage.get(TOKEN_KEY)).toBe('jwt-xyz')
  })

  it('del removes value from localStorage', async () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-del')
    const { authStorage } = await import('../utils/authStorage')
    await authStorage.del(TOKEN_KEY)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('does NOT call SecureStore on web', async () => {
    const SecureStore = await import('expo-secure-store')
    const { authStorage } = await import('../utils/authStorage')
    await authStorage.get(TOKEN_KEY)
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled()
  })
})
