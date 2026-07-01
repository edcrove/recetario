import { describe, it, expect } from 'vitest'
import { buildEntryMap, parseServings, formatShoppingQty } from '../utils/menuLogic'
import type { MenuEntry, ShoppingListItem } from '@recetario/shared'

const makeEntry = (date: string, slot: MenuEntry['slot'], recipeId = 'recipe-1'): MenuEntry => ({
  id: `${date}-${slot}-${recipeId}`,
  ownerId: 'owner',
  date,
  slot,
  recipeId,
  servings: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

describe('buildEntryMap', () => {
  it('returns empty map for no entries', () => {
    expect(buildEntryMap([])).toEqual(new Map())
  })

  it('keys entries by date::slot as array', () => {
    const entry = makeEntry('2026-06-29', 'Almuerzo')
    const map = buildEntryMap([entry])
    expect(map.get('2026-06-29::Almuerzo')).toEqual([entry])
  })

  it('handles multiple entries across days and slots', () => {
    const e1 = makeEntry('2026-06-29', 'Desayuno')
    const e2 = makeEntry('2026-06-29', 'Cena')
    const e3 = makeEntry('2026-06-30', 'Almuerzo')
    const map = buildEntryMap([e1, e2, e3])
    expect(map.size).toBe(3)
    expect(map.get('2026-06-29::Desayuno')).toEqual([e1])
    expect(map.get('2026-06-29::Cena')).toEqual([e2])
    expect(map.get('2026-06-30::Almuerzo')).toEqual([e3])
  })

  it('groups multiple recipes in the same slot', () => {
    const e1 = makeEntry('2026-06-29', 'Almuerzo', 'recipe-1')
    const e2 = makeEntry('2026-06-29', 'Almuerzo', 'recipe-2')
    const map = buildEntryMap([e1, e2])
    const entries = map.get('2026-06-29::Almuerzo')
    expect(entries).toHaveLength(2)
    expect(entries?.map((e) => e.recipeId)).toEqual(['recipe-1', 'recipe-2'])
  })

  it('returns empty array for unknown slot (via ?? [])', () => {
    const map = buildEntryMap([])
    expect(map.get('2026-06-29::Almuerzo') ?? []).toEqual([])
  })
})

describe('parseServings', () => {
  it('parses valid positive integer', () => {
    expect(parseServings('4', 2)).toBe(4)
  })

  it('returns fallback for non-numeric input', () => {
    expect(parseServings('abc', 2)).toBe(2)
  })

  it('returns fallback for zero', () => {
    expect(parseServings('0', 2)).toBe(2)
  })

  it('returns fallback for negative', () => {
    expect(parseServings('-1', 2)).toBe(2)
  })

  it('returns fallback for empty string', () => {
    expect(parseServings('', 2)).toBe(2)
  })

  it('handles decimal input (parseInt truncates)', () => {
    expect(parseServings('3.7', 2)).toBe(3)
  })
})

describe('formatShoppingQty', () => {
  it('returns "al gusto" for null quantity', () => {
    const item: ShoppingListItem = { ingredient: 'Sal', quantity: null, unit: null }
    expect(formatShoppingQty(item)).toBe('al gusto')
  })

  it('formats quantity with unit', () => {
    const item: ShoppingListItem = { ingredient: 'Harina', quantity: 200, unit: 'g' }
    expect(formatShoppingQty(item)).toBe('200 g')
  })

  it('formats quantity without unit', () => {
    const item: ShoppingListItem = { ingredient: 'Huevos', quantity: 3, unit: null }
    expect(formatShoppingQty(item)).toBe('3')
  })

  it('handles zero quantity with unit', () => {
    const item: ShoppingListItem = { ingredient: 'Sal', quantity: 0, unit: 'g' }
    expect(formatShoppingQty(item)).toBe('0 g')
  })

  // regression: bug 403 — units were shown in English (tsp instead of cdta)
  it('translates tsp to cdta', () => {
    const item: ShoppingListItem = { ingredient: 'Sal', quantity: 1, unit: 'tsp' }
    expect(formatShoppingQty(item)).toBe('1 cdta')
  })

  it('translates tbsp to cda', () => {
    const item: ShoppingListItem = { ingredient: 'Aceite', quantity: 2, unit: 'tbsp' }
    expect(formatShoppingQty(item)).toBe('2 cda')
  })

  it('translates cup to taza', () => {
    const item: ShoppingListItem = { ingredient: 'Harina', quantity: 1, unit: 'cup' }
    expect(formatShoppingQty(item)).toBe('1 taza')
  })
})
