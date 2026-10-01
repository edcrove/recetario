import {
  scaleQuantity,
  convertUnit,
  bestVolumeUnit,
  VOLUME_TO_ML,
  isCountUnit,
  roundCount,
} from '@recetario/shared'
import type { Ingredient } from '@recetario/shared'

export type DisplayMode = 'cooking' | 'metric' | 'imperial'

const UNIT_ES: Record<string, string> = {
  tsp: 'cdta',
  tbsp: 'cda',
  cup: 'taza',
  unit: 'u',
  pinch: 'pizca',
  slice: 'rodaja',
  clove: 'diente',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
}

export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return ''
  return UNIT_ES[unit] ?? unit
}

export function formatQuantity(qty: number | null): string {
  if (qty === null) return 'c/n'
  if (qty === Math.floor(qty)) return String(qty)
  return qty.toFixed(2).replace(/\.?0+$/, '')
}

/** Counts read as kitchen fractions: 1.5 → "1½", 0.5 → "½". */
export function formatCount(qty: number): string {
  const whole = Math.floor(qty)
  if (qty - whole !== 0.5) return formatQuantity(qty)
  return whole === 0 ? '½' : `${whole}½`
}

export function displayIngredient(
  ing: Ingredient,
  baseServings: number,
  targetServings: number,
  mode: DisplayMode,
): string {
  const scaled = scaleQuantity(ing.quantity, baseServings, targetServings)

  let finalQty = scaled
  let finalUnit = ing.unit

  // Metric/imperial only re-express volumes, picking a readable unit for the
  // scaled amount (500 ml leche → 2.08 tazas, not 100 cdtas). Mass and count
  // units stay as written: there is no imperial mass unit in the schema.
  const mlPerUnit = ing.unit ? VOLUME_TO_ML[ing.unit] : undefined
  if (scaled !== null && mode !== 'cooking' && mlPerUnit !== undefined) {
    finalUnit = bestVolumeUnit(scaled * mlPerUnit, mode)
    finalQty = convertUnit(scaled, ing.unit, finalUnit)
  }

  const qtyStr =
    finalQty !== null && isCountUnit(finalUnit)
      ? formatCount(roundCount(finalQty))
      : formatQuantity(finalQty)
  const parts = [qtyStr, unitLabel(finalUnit), ing.presentation, ing.name].filter(Boolean)
  return parts.join(' ') + (ing.note ? ` (${ing.note})` : '')
}
