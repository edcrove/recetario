import type { Unit } from './schema.js'
import { MASS_TO_G, VOLUME_TO_ML, convertUnit } from './units.js'

// g/ml density table — keyed by normalized ingredient name (lowercase, trimmed)
export const DENSITY_TABLE: Record<string, number> = {
  water: 1.0,
  milk: 1.03,
  oil: 0.92,
  'olive oil': 0.92,
  butter: 0.91,
  flour: 0.53,
  'all-purpose flour': 0.53,
  sugar: 0.85,
  'white sugar': 0.85,
  'brown sugar': 0.72,
  salt: 1.2,
  honey: 1.42,
  cream: 1.01,
  'heavy cream': 1.01,
  rice: 0.75,
  oats: 0.34,
  'cocoa powder': 0.5,
}

export function lookupDensity(ingredientName: string): number | null {
  return DENSITY_TABLE[ingredientName.toLowerCase().trim()] ?? null
}

/**
 * Convert volume↔mass using density (g/ml).
 * Falls back to convertUnit (within-dimension) if cross-dimension isn't possible.
 * Returns null if qty is null.
 */
export function convertWithDensity(
  qty: number | null,
  from: Unit | null,
  to: Unit | null,
  ingredientName?: string,
): number | null {
  if (qty === null) return null
  if (from === to) return qty

  const fromVol = from ? VOLUME_TO_ML[from] : undefined
  const toVol = to ? VOLUME_TO_ML[to] : undefined
  const fromMass = from ? MASS_TO_G[from] : undefined
  const toMass = to ? MASS_TO_G[to] : undefined

  const isVolToMass = fromVol !== undefined && toMass !== undefined
  const isMassToVol = fromMass !== undefined && toVol !== undefined

  if ((isVolToMass || isMassToVol) && ingredientName) {
    const density = lookupDensity(ingredientName)
    if (density !== null) {
      if (isVolToMass) {
        // vol → ml → g → target mass
        const ml = qty * fromVol
        const grams = ml * density
        return Math.round((grams / toMass!) * 1000) / 1000
      } else {
        // mass → g → ml → target vol
        const grams = qty * fromMass!
        const ml = grams / density
        return Math.round((ml / toVol!) * 1000) / 1000
      }
    }
    // density unknown: fall through to pass-through
    return qty
  }

  // Within-dimension or no density available: delegate
  return convertUnit(qty, from, to)
}
