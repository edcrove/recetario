import { createContext, useContext } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ThemeScheme = 'light' | 'dark'

export interface ThemeContextValue {
  /** What the user picked: follow the OS, or force light/dark. */
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  /** The effective scheme after resolving 'system' against the OS. */
  scheme: ThemeScheme
}

// Null when no provider is mounted (e.g. isolated screen tests) — consumers
// then fall back to the OS scheme.
export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useThemeContext(): ThemeContextValue | null {
  return useContext(ThemeContext)
}
