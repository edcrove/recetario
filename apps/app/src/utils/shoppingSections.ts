import { AISLE_ORDER, AISLE_LABELS, type Aisle, type ShoppingListEntry } from '@recetario/shared'

export interface ShoppingSection {
  aisle: Aisle
  title: string
  data: ShoppingListEntry[]
  checkedCount: number
}

/**
 * Nothing left to buy: checked off, or already in the household's pantry (the
 * API marks those with pantryMatch).
 */
export function isCovered(item: ShoppingListEntry): boolean {
  return item.checked || item.pantryMatch
}

/**
 * Buckets the flat shopping list into aisle sections in the canonical aisle
 * order (empty aisles dropped, "otros" last). Within a section, what is still
 * to buy comes first so covered items collapse to the bottom; the original
 * order is otherwise preserved (the API already sorts alphabetically).
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
    const data = [...list].sort((a, b) => Number(isCovered(a)) - Number(isCovered(b)))
    const checkedCount = list.filter(isCovered).length
    sections.push({ aisle, title: AISLE_LABELS[aisle], data, checkedCount })
  }
  return sections
}

/** Overall progress across the whole list (what's at home already counts). */
export function shoppingProgress(items: ShoppingListEntry[]): { checked: number; total: number } {
  return { checked: items.filter(isCovered).length, total: items.length }
}

/**
 * The list as plain text for the clipboard (WhatsApp, notes): only what is
 * still to buy, grouped by aisle in store order. Null when nothing is left.
 */
export function shoppingListText(
  items: ShoppingListEntry[],
  weekLabel: string,
  formatQty: (item: ShoppingListEntry) => string,
): string | null {
  const pending = items.filter((i) => !isCovered(i))
  if (pending.length === 0) return null
  const blocks = groupShoppingByAisle(pending).map(
    (s) => `${s.title}\n${s.data.map((i) => `- ${i.ingredient}: ${formatQty(i)}`).join('\n')}`,
  )
  return [`Lista de compras · ${weekLabel}`, ...blocks].join('\n\n')
}
