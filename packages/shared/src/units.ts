import type { Unit } from './schema.js'

// Conversion factors to base unit (ml for volume, g for mass)
export const VOLUME_TO_ML: Partial<Record<Unit, number>> = {
  tsp: 5,
  tbsp: 15,
  cup: 240,
  ml: 1,
  l: 1000,
}

export const MASS_TO_G: Partial<Record<Unit, number>> = {
  g: 1,
  kg: 1000,
}

export type UnitSystem = 'metric' | 'imperial' | 'cooking'

// Within-dimension conversion only.
// For cross-dimension (volume↔mass) see density.ts.
// Returns null if conversion is not possible (unknown/count units pass through).
export function convertUnit(qty: number | null, from: Unit | null, to: Unit | null): number | null {
  if (qty === null) return null
  if (from === to) return qty
  if (from === null || to === null) return qty

  // Volume
  const fromVol = VOLUME_TO_ML[from]
  const toVol = VOLUME_TO_ML[to]
  if (fromVol !== undefined && toVol !== undefined) {
    return Math.round(((qty * fromVol) / toVol) * 1000) / 1000
  }

  // Mass
  const fromMass = MASS_TO_G[from]
  const toMass = MASS_TO_G[to]
  if (fromMass !== undefined && toMass !== undefined) {
    return Math.round(((qty * fromMass) / toMass) * 1000) / 1000
  }

  // Cross-dimension or count/unknown: pass through unchanged
  return qty
}
