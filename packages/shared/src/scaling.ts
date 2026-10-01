/**
 * Scale a quantity from baseServings to targetServings.
 * null quantities ("to taste") pass through unchanged.
 * Returns null if qty is null; rounds to ≤2 decimals.
 */
export function scaleQuantity(
  qty: number | null,
  baseServings: number,
  targetServings: number,
): number | null {
  if (qty === null) return null
  if (baseServings <= 0) throw new Error('baseServings must be > 0')
  const scaled = (qty * targetServings) / baseServings
  return Math.round(scaled * 100) / 100
}

/** Units counted in whole things; null means a bare count ("2 huevos"). */
export const COUNT_UNITS = ['unit', 'clove', 'slice'] as const

export function isCountUnit(unit: string | null | undefined): boolean {
  return unit == null || (COUNT_UNITS as readonly string[]).includes(unit)
}

/**
 * Scaled counts snap to halves (1.33 huevos → 1.5, 0.2 dientes → 0.5): nobody
 * measures a third of an egg, and a positive amount never rounds to zero.
 */
export function roundCount(qty: number): number {
  if (qty <= 0) return qty
  return Math.max(0.5, Math.round(qty * 2) / 2)
}
