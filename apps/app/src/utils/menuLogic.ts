import type { MenuEntry, ShoppingListItem } from '@recetario/shared'

export function buildEntryMap(entries: MenuEntry[]): Map<string, MenuEntry[]> {
  const map = new Map<string, MenuEntry[]>()
  for (const entry of entries) {
    const key = `${entry.date}::${entry.slot}`
    const existing = map.get(key)
    if (existing) {
      existing.push(entry)
    } else {
      map.set(key, [entry])
    }
  }
  return map
}

import { unitLabel } from './displayIngredient.js'

// Things you buy whole: a third of an onion still means buying one.
const WHOLE_UNITS = new Set(['unit', 'clove', 'slice', 'pinch'])
const PLURAL: Record<string, string> = {
  diente: 'dientes',
  rodaja: 'rodajas',
  pizca: 'pizcas',
  taza: 'tazas',
}

/** Rounds a scaled quantity to something you can buy. */
export function shoppingQuantity(quantity: number, unit: string | null): number {
  if (!unit || WHOLE_UNITS.has(unit)) return Math.ceil(quantity - 1e-6)
  if (unit === 'g' || unit === 'ml')
    return quantity >= 100 ? Math.ceil(quantity / 10) * 10 : Math.ceil(quantity)
  return Math.round(quantity * 100) / 100
}

export function formatShoppingQty(item: ShoppingListItem): string {
  if (item.quantity == null) return 'al gusto'
  const qty = shoppingQuantity(item.quantity, item.unit)
  if (!item.unit) return String(qty)
  const label = unitLabel(item.unit)
  return `${qty} ${qty > 1 ? (PLURAL[label] ?? label) : label}`
}
