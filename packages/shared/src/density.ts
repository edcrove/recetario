import type { Unit } from './schema.js'
import { MASS_TO_G, VOLUME_TO_ML, convertUnit } from './units.js'
import { normalizeIngredientName } from './ingredientName.js'

// g/ml densities. Keys are written naturally (Spanish first: recipes are in
// Spanish) and normalized once with normalizeIngredientName, the same key the
// shopping list uses, so accents, case and plurals don't matter on lookup.
const DENSITIES: Record<string, number> = {
  agua: 1.0,
  leche: 1.03,
  aceite: 0.92,
  'aceite de oliva': 0.92,
  'aceite de girasol': 0.92,
  manteca: 0.91,
  mantequilla: 0.91,
  harina: 0.53,
  'harina de trigo': 0.53,
  'harina integral': 0.51,
  maicena: 0.54,
  'fécula de maíz': 0.54,
  azúcar: 0.85,
  'azúcar blanca': 0.85,
  'azúcar negra': 0.72,
  'azúcar rubia': 0.72,
  'azúcar impalpable': 0.56,
  sal: 1.2,
  'sal fina': 1.2,
  miel: 1.42,
  crema: 1.01,
  'crema de leche': 1.01,
  yogur: 1.03,
  arroz: 0.75,
  avena: 0.34,
  cacao: 0.5,
  'cacao amargo': 0.5,
  'polvo de hornear': 0.9,
  // English names, for imported recipes
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

export const DENSITY_TABLE: Record<string, number> = Object.fromEntries(
  Object.entries(DENSITIES).map(([name, density]) => [normalizeIngredientName(name), density]),
)

/**
 * g/ml for an ingredient, or null. Tries the full normalized name, then drops
 * trailing words so qualifiers still match ("harina 0000" → harina,
 * "aceite de oliva extra virgen" → aceite de oliva).
 */
export function lookupDensity(ingredientName: string): number | null {
  const words = normalizeIngredientName(ingredientName).split(' ')
  for (let n = words.length; n > 0; n--) {
    const density = DENSITY_TABLE[words.slice(0, n).join(' ')]
    if (density !== undefined) return density
  }
  return null
}

/**
 * Convert volume↔mass using density (g/ml).
 * Within one dimension it delegates to convertUnit. Returns null if qty is
 * null, or for a volume↔mass conversion with no known density: passing the
 * number through would print "1 taza harina" as "1 g".
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
    return null
  }

  // Within-dimension or no density available: delegate
  return convertUnit(qty, from, to)
}
