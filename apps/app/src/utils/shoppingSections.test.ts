import { describe, it, expect } from 'vitest'
import type { ShoppingListEntry } from '@recetario/shared'
import { groupShoppingByAisle, shoppingProgress } from './shoppingSections'

const entry = (over: Partial<ShoppingListEntry>): ShoppingListEntry => ({
  ingredient: 'x',
  quantity: 1,
  unit: 'unit',
  key: 'x',
  aisle: 'otros',
  checked: false,
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
