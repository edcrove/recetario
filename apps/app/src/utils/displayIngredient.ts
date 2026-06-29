import { scaleQuantity, convertUnit, convertWithDensity } from '@recetario/shared'
import type { Ingredient, Unit } from '@recetario/shared'

export type DisplayMode = 'cooking' | 'metric' | 'imperial'

export function formatQuantity(qty: number | null): string {
  if (qty === null) return 'c/n'
  if (qty === Math.floor(qty)) return String(qty)
  return qty.toFixed(2).replace(/\.?0+$/, '')
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

  if (scaled !== null && ing.unit) {
    if (mode === 'metric') {
      finalUnit = ing.unit && ['tsp', 'tbsp', 'cup'].includes(ing.unit) ? 'ml' : ing.unit
      finalQty = convertUnit(scaled, ing.unit, finalUnit)
    } else if (mode === 'imperial') {
      finalUnit = ing.unit === 'ml' ? 'tsp' : ing.unit === 'l' ? 'cup' : ing.unit
      finalQty = convertUnit(scaled, ing.unit, finalUnit)
    }
    finalQty = convertWithDensity(scaled, ing.unit as Unit, finalUnit as Unit, ing.name)
  }

  const qtyStr = formatQuantity(finalQty)
  const parts = [qtyStr, finalUnit, ing.presentation, ing.name].filter(Boolean)
  return parts.join(' ') + (ing.note ? ` (${ing.note})` : '')
}
