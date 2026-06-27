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
