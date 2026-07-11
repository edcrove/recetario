import { useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import { authStorage } from '../utils/authStorage'
import { ThemeContext, type ThemePreference, type ThemeScheme } from './themeContext'

const KEY = 'theme_preference'

/**
 * Holds the user's theme choice (Sistema/Claro/Oscuro), persists it, and
 * resolves 'system' against the OS setting. Wrap the app so useThemeColors
 * and the profile selector share one source of truth.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const osScheme: ThemeScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const [preference, setPref] = useState<ThemePreference>('system')

  useEffect(() => {
    void authStorage.get(KEY).then((v) => {
      if (v === 'system' || v === 'light' || v === 'dark') setPref(v)
    })
  }, [])

  const setPreference = (p: ThemePreference) => {
    setPref(p)
    void authStorage.set(KEY, p)
  }

  const scheme: ThemeScheme = preference === 'system' ? osScheme : preference

  return (
    <ThemeContext.Provider value={{ preference, setPreference, scheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
