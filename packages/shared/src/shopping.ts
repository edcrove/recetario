import type { Unit } from './schema.js'
import { VOLUME_TO_ML, MASS_TO_G } from './units.js'
import { lookupDensity } from './density.js'
import { normalizeIngredientName } from './ingredientName.js'
import { ingredientAisle, type Aisle } from './aisle.js'

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

/** A shopping-list line enriched for the sectioned UI: its stable matching key
 * (normalized name), the aisle it groups under, whether it's been checked, and
 * whether the household already has it in the pantry. */
export type ShoppingListEntry = ShoppingListItem & {
  key: string
  aisle: Aisle
  checked: boolean
  pantryMatch: boolean
}

/**
 * Enriches aggregated items with their aisle, persisted check state and pantry
 * match. `key` is the normalized name — the same key used to store checks and to
 * match the pantry — so state survives plural/accented spellings. `pantryKeys`
 * holds the canonical keys of in-stock pantry items.
 */
export function enrichShoppingList(
  items: ShoppingListItem[],
  checkedKeys: ReadonlySet<string>,
  pantryKeys: ReadonlySet<string> = new Set(),
): ShoppingListEntry[] {
  return items.map((item) => {
    const key = normalizeIngredientName(item.ingredient)
    return {
      ...item,
      key,
      aisle: ingredientAisle(item.ingredient),
      checked: checkedKeys.has(key),
      pantryMatch: pantryKeys.has(key),
    }
  })
}

function normalizeKey(name: string): string {
  return normalizeIngredientName(name)
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
/** Resolves an ingredient name to a grouping key and the label to show for it. */
export type IngredientResolver = (name: string) => { key: string; display: string }

const defaultResolver: IngredientResolver = (name) => ({
  key: normalizeKey(name),
  display: name.trim(),
})

export function aggregateIngredients(
  ingredients: ScaledIngredient[],
  resolve: IngredientResolver = defaultResolver,
): ShoppingListItem[] {
  // Step 1: Group by (resolved key, unit) and sum quantities — skip zero-quantity
  // items. `resolve` maps a raw name to its grouping key (a canonical ingredient
  // when the API supplies the resolver, otherwise the normalized name) and the
  // display label; the first label seen for a key wins.
  const grouped = new Map<string, UnitGroup>()
  const display = new Map<string, string>()

  for (const ing of ingredients) {
    if (ing.quantity !== null && ing.quantity <= 0) continue
    const { key: norm, display: label } = resolve(ing.name)
    if (!display.has(norm)) display.set(norm, label)
    const key = `${norm}::${ing.unit ?? '__null__'}`
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
    // Every byName key came from a norm recorded in `display`, so it is present.
    result.push(...tryMerge(display.get(name)!, items))
  }

  return result.sort((a, b) => a.ingredient.localeCompare(b.ingredient))
}
