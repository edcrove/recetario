import type { Unit } from './schema.js'
import { VOLUME_TO_ML, MASS_TO_G } from './units.js'
import { lookupDensity } from './density.js'

export type ScaledIngredient = {
  name: string
  quantity: number | null
  unit: Unit | null
}

export type ShoppingListItem = {
  ingredient: string
  quantity: number | null
  unit: Unit | null
}

function normalizeKey(name: string): string {
  return name.toLowerCase().trim()
}

function toGrams(qty: number, unit: Unit): number {
  return qty * MASS_TO_G[unit]!
}

function toMl(qty: number, unit: Unit): number {
  return qty * VOLUME_TO_ML[unit]!
}

type UnitGroup = { quantity: number | null; unit: Unit | null }

function tryMerge(name: string, items: UnitGroup[]): ShoppingListItem[] {
  if (items.length === 1) return [{ ingredient: name, ...items[0]! }]

  // Separate by dimension
  const massItems: UnitGroup[] = []
  const volItems: UnitGroup[] = []
  const otherItems: UnitGroup[] = []

  for (const item of items) {
    if (item.quantity === null) {
      otherItems.push(item)
      continue
    }
    if (item.unit !== null && MASS_TO_G[item.unit] !== undefined) {
      massItems.push(item)
    } else if (item.unit !== null && VOLUME_TO_ML[item.unit] !== undefined) {
      volItems.push(item)
    } else {
      otherItems.push(item)
    }
  }

  const result: ShoppingListItem[] = []

  // Merge all mass items → g
  if (massItems.length > 0) {
    const totalG = massItems.reduce(
      (sum, item) => sum + toGrams(item.quantity!, item.unit as Unit),
      0,
    )
    result.push({ ingredient: name, quantity: Math.round(totalG * 1000) / 1000, unit: 'g' })
  }

  // Merge all volume items → ml
  if (volItems.length > 0) {
    const totalMl = volItems.reduce((sum, item) => sum + toMl(item.quantity!, item.unit as Unit), 0)
    result.push({ ingredient: name, quantity: Math.round(totalMl * 1000) / 1000, unit: 'ml' })
  }

  // Try cross-dimension merge using density (vol → g)
  if (massItems.length > 0 && volItems.length > 0 && result.length >= 2) {
    const density = lookupDensity(name)
    if (density !== null) {
      const massG = result.find((r) => r.unit === 'g')!.quantity!
      const volMl = result.find((r) => r.unit === 'ml')!.quantity!
      const totalG = massG + volMl * density
      // Replace the two separate entries with one merged g entry
      result.length = 0
      result.push({ ingredient: name, quantity: Math.round(totalG * 1000) / 1000, unit: 'g' })
    }
  }

  // Add "to taste" or count/unknown items as-is
  for (const item of otherItems) {
    result.push({ ingredient: name, ...item })
  }

  return result
}

/**
 * Aggregate scaled ingredients into a shopping list.
 * Same (name, unit) pairs are summed. Different units for the same ingredient
 * are merged via the density model when possible, otherwise kept as separate lines.
 */
export function aggregateIngredients(ingredients: ScaledIngredient[]): ShoppingListItem[] {
  // Step 1: Group by (normalized name, unit) and sum quantities
  const grouped = new Map<string, UnitGroup>()

  for (const ing of ingredients) {
    const key = `${normalizeKey(ing.name)}::${ing.unit ?? '__null__'}`
    const existing = grouped.get(key)
    if (existing) {
      existing.quantity =
        existing.quantity !== null && ing.quantity !== null
          ? existing.quantity + ing.quantity
          : null
    } else {
      grouped.set(key, { quantity: ing.quantity, unit: ing.unit })
    }
  }

  // Step 2: Group by normalized name for cross-unit merge
  const byName = new Map<string, UnitGroup[]>()
  for (const [key, value] of grouped) {
    const name = key.split('::')[0]!
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name)!.push(value)
  }

  // Step 3: Merge and sort
  const result: ShoppingListItem[] = []
  for (const [name, items] of byName) {
    result.push(...tryMerge(name, items))
  }

  return result.sort((a, b) => a.ingredient.localeCompare(b.ingredient))
}
