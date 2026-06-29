import { scaleQuantity } from '@recetario/shared'
import type { Ingredient } from '@recetario/shared'

export function formatQty(qty: number | null): string {
  if (qty === null) return 'c/n'
  if (qty === Math.floor(qty)) return String(qty)
  return qty.toFixed(2).replace(/\.?0+$/, '')
}

export function formatIngredient(ing: Ingredient, base: number, target: number): string {
  const scaled = scaleQuantity(ing.quantity, base, target)
  const parts = [formatQty(scaled), ing.unit, ing.presentation, ing.name].filter(Boolean)
  return parts.join(' ') + (ing.note ? ` (${ing.note})` : '')
}
