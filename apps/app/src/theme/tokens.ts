import { useColorScheme } from 'react-native'

/**
 * "Cocina cálida" design tokens — the visual identity approved 2026-07-08
 * (mockup: https://claude.ai/code/artifact/78bdcac4-e2bf-4a0a-ac05-343bb2557363).
 *
 * Use `useThemeColors()` in screens so they follow the OS light/dark setting.
 * The `colors` export is the light palette kept for backward compatibility with
 * the screens not yet migrated; new UI should prefer the hook.
 *
 * The display face is a warm serif stack (the mockup used Charter/Georgia as a
 * proxy for Fraunces). Bundling the exact Fraunces binary is tracked separately.
 */
export interface ThemeColors {
  paper: string
  surface: string
  ink: string
  inkSoft: string
  sand: string
  line: string
  terracotta: string
  terracottaInk: string
  terracottaSoft: string
  sage: string
  sageSoft: string
  danger: string
  dangerSoft: string
}

export const lightColors: ThemeColors = {
  paper: '#F7F2EA',
  surface: '#FFFDF9',
  ink: '#2A2521',
  inkSoft: '#6B6259',
  sand: '#E8DCC8',
  line: '#E3D9C9',
  terracotta: '#B93E14',
  terracottaInk: '#FFF6F1',
  terracottaSoft: '#F3DFD4',
  sage: '#5C7052',
  sageSoft: '#E4EAE0',
  danger: '#B3261E',
  dangerSoft: '#F7DCDA',
}

// Mirrored, not naively inverted: warm charcoal grounds and a brighter
// terracotta/sage so the accents keep AA contrast on the dark ground.
export const darkColors: ThemeColors = {
  paper: '#17130F',
  surface: '#221C16',
  ink: '#EDE6DD',
  inkSoft: '#A89C8F',
  sand: '#33291F',
  line: '#362C21',
  terracotta: '#E0714A',
  terracottaInk: '#2A1108',
  terracottaSoft: '#3B2418',
  sage: '#93AA88',
  sageSoft: '#26301F',
  danger: '#F2B8B5',
  dangerSoft: '#3A1D1B',
}

/** Warm serif display stack for recipe/section titles. */
export const fonts = {
  display: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif',
} as const

/** Backward-compatible light palette for screens not yet migrated to the hook. */
export const colors = lightColors

/** Returns the palette for the active OS color scheme. */
export function useThemeColors(): ThemeColors {
  return useColorScheme() === 'dark' ? darkColors : lightColors
}
