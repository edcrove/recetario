import { describe, it, expect } from 'vitest'
import type { ShoppingListEntry } from '@recetario/shared'
import { groupShoppingByAisle, shoppingListText, shoppingProgress } from './shoppingSections'
import { formatShoppingQty } from './menuLogic'

const entry = (over: Partial<ShoppingListEntry>): ShoppingListEntry => ({
  ingredient: 'x',
  quantity: 1,
  unit: 'unit',
  key: 'x',
  aisle: 'otros',
  checked: false,
  pantryMatch: false,
  ...over,
})

describe('groupShoppingByAisle', () => {
  it('returns empty for empty input', () => {
    expect(groupShoppingByAisle([])).toEqual([])
  })

  it('groups by aisle in canonical order with otros last and drops empty aisles', () => {
    const sections = groupShoppingByAisle([
      entry({ ingredient: 'sal', key: 'sal', aisle: 'almacen' }),
      entry({ ingredient: 'tomate', key: 'tomate', aisle: 'verduleria' }),
      entry({ ingredient: 'rareza', key: 'rareza', aisle: 'otros' }),
    ])
    expect(sections.map((s) => s.aisle)).toEqual(['verduleria', 'almacen', 'otros'])
    expect(sections[0]!.title).toBe('Verdulería')
  })

  it('sorts checked items to the bottom of their section and counts them', () => {
    const sections = groupShoppingByAisle([
      entry({ ingredient: 'tomate', key: 'tomate', aisle: 'verduleria', checked: true }),
      entry({ ingredient: 'lechuga', key: 'lechuga', aisle: 'verduleria', checked: false }),
      entry({ ingredient: 'cebolla', key: 'cebolla', aisle: 'verduleria', checked: false }),
    ])
    const verd = sections[0]!
    expect(verd.data.map((i) => i.key)).toEqual(['lechuga', 'cebolla', 'tomate'])
    expect(verd.checkedCount).toBe(1)
  })
})

describe('shoppingProgress', () => {
  it('counts checked vs total', () => {
    expect(
      shoppingProgress([
        entry({ checked: true }),
        entry({ checked: false }),
        entry({ checked: true }),
      ]),
    ).toEqual({ checked: 2, total: 3 })
  })

  it('is zero for an empty list', () => {
    expect(shoppingProgress([])).toEqual({ checked: 0, total: 0 })
  })
})

// Story "Expo: shopping list UI": "Copy-to-clipboard button (plain text format)".
describe('shoppingListText', () => {
  const items = [
    entry({ ingredient: 'sal', key: 'sal', aisle: 'almacen', quantity: null, unit: null }),
    entry({ ingredient: 'tomate', key: 'tomate', aisle: 'verduleria', quantity: 3, unit: 'unit' }),
    entry({ ingredient: 'cebolla', key: 'cebolla', aisle: 'verduleria', quantity: 500, unit: 'g' }),
    entry({ ingredient: 'leche', key: 'leche', aisle: 'lacteos', checked: true }),
  ]

  it('lists what is left to buy, by aisle in store order, with formatted quantities', () => {
    expect(shoppingListText(items, 'semana del 7 jul', formatShoppingQty)).toBe(
      [
        'Lista de compras · semana del 7 jul',
        'Verdulería\n- tomate: 3 u\n- cebolla: 500 g',
        'Almacén\n- sal: al gusto',
      ].join('\n\n'),
    )
  })

  it('leaves out items already ticked off', () => {
    expect(shoppingListText(items, 'x', formatShoppingQty)).not.toContain('leche')
  })

  it('returns null when everything is ticked off or the list is empty', () => {
    expect(shoppingListText([entry({ checked: true })], 'x', formatShoppingQty)).toBeNull()
    expect(shoppingListText([], 'x', formatShoppingQty)).toBeNull()
  })

  it('uses the given quantity formatter for every line', () => {
    const text = shoppingListText(items, 'x', (i) => `[${i.key}]`)
    expect(text).toContain('- tomate: [tomate]')
    expect(text).toContain('- sal: [sal]')
  })
})
