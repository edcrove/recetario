import { describe, it, expect } from 'vitest'
import { expiryStatus, groupPantry, type PantryItem } from './pantryView'

const item = (over: Partial<PantryItem>): PantryItem => ({
  id: 'x',
  name: 'X',
  quantity: null,
  unit: null,
  expiryDate: null,
  inStock: true,
  ...over,
})

describe('expiryStatus', () => {
  const today = new Date(2026, 6, 11) // 2026-07-11

  it('returns null for no expiry or an unparseable date', () => {
    expect(expiryStatus(null, today)).toBeNull()
    expect(expiryStatus('not-a-date', today)).toBeNull()
  })

  it('flags a past date as vencido', () => {
    expect(expiryStatus('2026-07-10', today)).toBe('vencido')
  })

  it('flags today and within 3 days as pronto', () => {
    expect(expiryStatus('2026-07-11', today)).toBe('pronto')
    expect(expiryStatus('2026-07-14', today)).toBe('pronto')
  })

  it('flags 4+ days away as ok', () => {
    expect(expiryStatus('2026-07-15', today)).toBe('ok')
  })
})

describe('groupPantry', () => {
  it('splits by stock and sorts each group by name', () => {
    const { inStock, outOfStock } = groupPantry([
      item({ id: '1', name: 'Sal', inStock: true }),
      item({ id: '2', name: 'Arroz', inStock: true }),
      item({ id: '3', name: 'Leche', inStock: false }),
    ])
    expect(inStock.map((i) => i.name)).toEqual(['Arroz', 'Sal'])
    expect(outOfStock.map((i) => i.name)).toEqual(['Leche'])
  })
})
