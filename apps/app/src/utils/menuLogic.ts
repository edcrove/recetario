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

export function formatShoppingQty(item: ShoppingListItem): string {
  if (item.quantity == null) return 'al gusto'
  return item.unit ? `${item.quantity} ${unitLabel(item.unit)}` : String(item.quantity)
}
