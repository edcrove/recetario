/**
 * "Cocina cálida" design tokens — the visual identity approved 2026-07-08
 * (mockup: https://claude.ai/code/artifact/78bdcac4-e2bf-4a0a-ac05-343bb2557363).
 *
 * New UI must use these instead of hardcoded hex values. Existing screens
 * migrate incrementally under the visual-identity epic; the dark set arrives
 * with that epic's useColorScheme wiring.
 */
export const colors = {
  /** Fondo base (60%) — papel cálido */
  paper: '#F7F2EA',
  /** Superficies elevadas (cards, modales) */
  surface: '#FFFDF9',
  /** Texto principal — tinta cálida */
  ink: '#2A2521',
  /** Texto secundario */
  inkSoft: '#6B6259',
  /** Bordes, chips neutros (30%) */
  sand: '#E8DCC8',
  line: '#E3D9C9',
  /** Acento primario (10%) — CTAs y marca */
  terracotta: '#B93E14',
  terracottaInk: '#FFF6F1',
  terracottaSoft: '#F3DFD4',
  /** Señales dietéticas / frescura */
  sage: '#5C7052',
  sageSoft: '#E4EAE0',
  /** Reservado a alérgenos y acciones destructivas — nunca de acento */
  danger: '#B3261E',
  dangerSoft: '#F7DCDA',
} as const
