import { describe, it, expect, vi, afterEach } from 'vitest'

const mockScheme = vi.fn(() => 'light')
vi.mock('react-native', () => ({ useColorScheme: () => mockScheme() }))

import { useThemeColors, lightColors, darkColors } from '../theme/tokens'

afterEach(() => mockScheme.mockReturnValue('light'))

describe('useThemeColors', () => {
  it('returns the light palette by default', () => {
    mockScheme.mockReturnValue('light')
    expect(useThemeColors()).toBe(lightColors)
  })
  it('returns the dark palette when the OS is dark', () => {
    mockScheme.mockReturnValue('dark')
    expect(useThemeColors()).toBe(darkColors)
  })
  it('light and dark define the same token keys', () => {
    expect(Object.keys(lightColors).sort()).toEqual(Object.keys(darkColors).sort())
  })
})
