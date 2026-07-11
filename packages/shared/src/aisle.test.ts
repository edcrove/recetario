import { describe, it, expect } from 'vitest'
import { ingredientAisle, AISLE_ORDER, AISLE_LABELS } from './aisle.js'

describe('ingredientAisle', () => {
  it('classifies produce as verdulería', () => {
    expect(ingredientAisle('tomate')).toBe('verduleria')
    expect(ingredientAisle('Cebollas')).toBe('verduleria')
    expect(ingredientAisle('manzana verde')).toBe('verduleria')
    expect(ingredientAisle('dientes de ajo')).toBe('verduleria')
  })

  it('classifies meat and fish', () => {
    expect(ingredientAisle('carne picada')).toBe('carniceria')
    expect(ingredientAisle('pollo')).toBe('carniceria')
    expect(ingredientAisle('merluza')).toBe('pescaderia')
    expect(ingredientAisle('camarones')).toBe('pescaderia')
  })

  it('classifies dairy and deli', () => {
    expect(ingredientAisle('leche')).toBe('lacteos')
    expect(ingredientAisle('queso rallado')).toBe('lacteos')
    expect(ingredientAisle('jamón cocido')).toBe('fiambreria')
  })

  it('classifies bakery and pantry staples', () => {
    expect(ingredientAisle('pan rallado')).toBe('panaderia')
    expect(ingredientAisle('harina')).toBe('almacen')
    expect(ingredientAisle('arroz')).toBe('almacen')
    expect(ingredientAisle('aceite de oliva')).toBe('almacen')
  })

  it('classifies drinks, frozen and cleaning', () => {
    expect(ingredientAisle('vino tinto')).toBe('bebidas')
    expect(ingredientAisle('arvejas congeladas')).toBe('congelados')
    expect(ingredientAisle('detergente')).toBe('limpieza')
  })

  it('falls back to otros for anything unknown', () => {
    expect(ingredientAisle('polvo de hornear galáctico')).toBe('otros')
    expect(ingredientAisle('')).toBe('otros')
  })

  it('is accent- and plural-insensitive', () => {
    expect(ingredientAisle('LIMÓN')).toBe('verduleria')
    expect(ingredientAisle('huevos')).toBe('almacen')
  })

  it('exposes a stable display order that includes otros last and matching labels', () => {
    expect(AISLE_ORDER[0]).toBe('verduleria')
    expect(AISLE_ORDER[AISLE_ORDER.length - 1]).toBe('otros')
    for (const a of AISLE_ORDER) {
      expect(typeof AISLE_LABELS[a]).toBe('string')
      expect(AISLE_LABELS[a].length).toBeGreaterThan(0)
    }
  })
})
