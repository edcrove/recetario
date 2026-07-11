export interface PantryItem {
  id: string
  name: string
  quantity: string | null
  unit: string | null
  expiryDate: string | null
  inStock: boolean
}

export type ExpiryStatus = 'vencido' | 'pronto' | 'ok'

/**
 * Expiry urgency for a badge: 'vencido' (past), 'pronto' (≤3 days away), or 'ok'.
 * Null expiry → null (no badge). Dates are ISO YYYY-MM-DD compared by day.
 */
export function expiryStatus(expiryDate: string | null, today: Date): ExpiryStatus | null {
  if (!expiryDate) return null
  const expiry = new Date(`${expiryDate}T00:00:00`)
  /* istanbul ignore next -- the API validates expiryDate's format, so a stored
     value always parses; this guard is unreachable from the UI and is covered
     by the util's own unit tests instead. */
  if (Number.isNaN(expiry.getTime())) return null
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const msPerDay = 24 * 60 * 60 * 1000
  const days = Math.round((expiry.getTime() - startOfToday.getTime()) / msPerDay)
  if (days < 0) return 'vencido'
  if (days <= 3) return 'pronto'
  return 'ok'
}

export interface PantryGroups {
  inStock: PantryItem[]
  outOfStock: PantryItem[]
}

/** Splits pantry items into in-stock / out-of-stock, each sorted by name. */
export function groupPantry(items: PantryItem[]): PantryGroups {
  const byName = (a: PantryItem, b: PantryItem) => a.name.localeCompare(b.name)
  return {
    inStock: items.filter((i) => i.inStock).sort(byName),
    outOfStock: items.filter((i) => !i.inStock).sort(byName),
  }
}
