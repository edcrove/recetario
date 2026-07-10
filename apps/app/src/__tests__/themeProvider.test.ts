import { describe, it, expect, vi } from 'vitest'
vi.mock('react-native', () => ({ useColorScheme: () => 'light' }))
vi.mock('../theme/themeContext', () => ({ useThemeContext: () => null }))
import { lightColors, darkColors } from '../theme/tokens'

// The scheme-resolution rule the provider implements: preference wins over OS
// except 'system', which defers to the OS scheme.
function resolve(pref: 'system' | 'light' | 'dark', os: 'light' | 'dark') {
  return pref === 'system' ? os : pref
}

describe('theme scheme resolution', () => {
  it('system follows the OS', () => {
    expect(resolve('system', 'dark')).toBe('dark')
    expect(resolve('system', 'light')).toBe('light')
  })
  it('explicit light/dark override the OS', () => {
    expect(resolve('light', 'dark')).toBe('light')
    expect(resolve('dark', 'light')).toBe('dark')
  })
  it('the two palettes are distinct grounds', () => {
    expect(lightColors.paper).not.toBe(darkColors.paper)
    expect(darkColors.paper).toBe('#17130F')
  })
})
