import { describe, it, expect } from 'vitest'
import type { ShoppingListEntry } from '@recetario/shared'
import {
  groupShoppingByAisle,
  isCovered,
  shoppingListText,
  shoppingProgress,
} from '../utils/shoppingSections'

const entry = (ingredient: string, over: Partial<ShoppingListEntry> = {}) =>
  ({
    ingredient,
    quantity: 1,
    unit: null,
    key: ingredient,
    aisle: 'almacen',
    checked: false,
    pantryMatch: false,
    ...over,
  }) as ShoppingListEntry

// 2026-10-02 review: the API marks what the household already has
// (pantryMatch), but the list ignored it and asked you to buy it anyway.
describe('shopping list and the pantry', () => {
  const list = [
    entry('Arroz', { pantryMatch: true }),
    entry('Fideos'),
    entry('Sal', { checked: true }),
  ]

  it('what is at home or checked off is covered; the rest is still to buy', () => {
    expect(list.map(isCovered)).toEqual([true, false, true])
  })

  it('covered items sink below what is still to buy and count as done', () => {
    const [section] = groupShoppingByAisle(list)
    expect(section?.data.map((i) => i.ingredient)).toEqual(['Fideos', 'Arroz', 'Sal'])
    expect(section?.checkedCount).toBe(2)
    expect(shoppingProgress(list)).toEqual({ checked: 2, total: 3 })
  })

  it('the copied list leaves out what is at home', () => {
    expect(shoppingListText(list, 'semana', () => '1')).toBe(
      'Lista de compras · semana\n\nAlmacén\n- Fideos: 1',
    )
    expect(shoppingListText([entry('Arroz', { pantryMatch: true })], 's', () => '1')).toBeNull()
  })
})
