import { AISLE_ORDER, AISLE_LABELS, type Aisle, type ShoppingListEntry } from '@recetario/shared'

export interface ShoppingSection {
  aisle: Aisle
  title: string
  data: ShoppingListEntry[]
  checkedCount: number
}

/**
 * Buckets the flat shopping list into aisle sections in the canonical aisle
 * order (empty aisles dropped, "otros" last). Within a section, unchecked items
 * come first so ticked-off items collapse to the bottom; the original order is
 * otherwise preserved (the API already sorts alphabetically).
 */
export function groupShoppingByAisle(items: ShoppingListEntry[]): ShoppingSection[] {
  const buckets = new Map<Aisle, ShoppingListEntry[]>()
  for (const item of items) {
    const list = buckets.get(item.aisle)
    if (list) list.push(item)
    else buckets.set(item.aisle, [item])
  }

  const sections: ShoppingSection[] = []
  for (const aisle of AISLE_ORDER) {
    const list = buckets.get(aisle)
    if (!list || list.length === 0) continue
    const data = [...list].sort((a, b) => Number(a.checked) - Number(b.checked))
    const checkedCount = list.filter((i) => i.checked).length
    sections.push({ aisle, title: AISLE_LABELS[aisle], data, checkedCount })
  }
  return sections
}

/** Overall check-off progress across the whole list. */
export function shoppingProgress(items: ShoppingListEntry[]): { checked: number; total: number } {
  return { checked: items.filter((i) => i.checked).length, total: items.length }
}
