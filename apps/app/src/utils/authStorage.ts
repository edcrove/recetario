import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

/**
 * The SecureStore branches are excluded from E2E coverage: chromium-based
 * Playwright E2E always runs with Platform.OS === 'web', so they are
 * structurally unreachable there. They are fully covered by unit tests
 * (authStorage.test.ts), which mock Platform.OS and expo-secure-store.
 */
export const authStorage = {
  async get(key: string): Promise<string | null> {
    /* istanbul ignore else -- native path unreachable in chromium E2E; unit-tested */
    if (Platform.OS === 'web') return localStorage.getItem(key)
    /* istanbul ignore next -- native path unreachable in chromium E2E; unit-tested */
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string): Promise<void> {
    /* istanbul ignore else -- native path unreachable in chromium E2E; unit-tested */
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
      return
    }
    /* istanbul ignore next -- native path unreachable in chromium E2E; unit-tested */
    return SecureStore.setItemAsync(key, value)
  },
  async del(key: string): Promise<void> {
    /* istanbul ignore else -- native path unreachable in chromium E2E; unit-tested */
    if (Platform.OS === 'web') {
      localStorage.removeItem(key)
      return
    }
    /* istanbul ignore next -- native path unreachable in chromium E2E; unit-tested */
    return SecureStore.deleteItemAsync(key)
  },
}
