import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

export const authStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key)
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
      return
    }
    return SecureStore.setItemAsync(key, value)
  },
  async del(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key)
      return
    }
    return SecureStore.deleteItemAsync(key)
  },
}
