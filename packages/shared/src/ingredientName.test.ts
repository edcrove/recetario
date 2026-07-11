import { describe, it, expect } from 'vitest'
import { normalizeIngredientName } from './ingredientName.js'

describe('normalizeIngredientName', () => {
  it('lowercases and trims', () => {
    expect(normalizeIngredientName('  Sal  ')).toBe('sal')
    expect(normalizeIngredientName('AZÚCAR')).toBe('azucar')
  })

  it('strips accents/diacritics', () => {
    expect(normalizeIngredientName('limón')).toBe('limon')
    expect(normalizeIngredientName('jamón')).toBe('jamon')
    expect(normalizeIngredientName('pimentón')).toBe('pimenton')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeIngredientName('aceite   de  oliva')).toBe('aceite de oliva')
  })

  it('singularizes simple vowel plurals (…s after a vowel)', () => {
    expect(normalizeIngredientName('tomates')).toBe('tomate')
    expect(normalizeIngredientName('papas')).toBe('papa')
    expect(normalizeIngredientName('cebollas')).toBe('cebolla')
    expect(normalizeIngredientName('huevos')).toBe('huevo')
  })

  it('singularizes consonant plurals (…es after l/n/r/d/j)', () => {
    expect(normalizeIngredientName('limones')).toBe('limon')
    expect(normalizeIngredientName('panes')).toBe('pan')
    expect(normalizeIngredientName('flores')).toBe('flor')
  })

  it('handles the -ces → -z plural', () => {
    expect(normalizeIngredientName('nueces')).toBe('nuez')
    expect(normalizeIngredientName('luces')).toBe('luz')
  })

  it('makes plural/singular/accented/cased variants collide', () => {
    const a = normalizeIngredientName('Tomates')
    const b = normalizeIngredientName('tomate')
    expect(a).toBe(b)
    expect(normalizeIngredientName('Limones')).toBe(normalizeIngredientName('limón'))
  })

  it('normalizes each word of a multi-word name', () => {
    expect(normalizeIngredientName('Papas Fritas')).toBe('papa frita')
    expect(normalizeIngredientName('dientes de ajo')).toBe('diente de ajo')
  })

  it('leaves short words and non-plurals untouched', () => {
    expect(normalizeIngredientName('arroz')).toBe('arroz')
    expect(normalizeIngredientName('gas')).toBe('gas') // len 3, not stripped
    expect(normalizeIngredientName('té')).toBe('te')
  })

  it('returns empty string for blank input', () => {
    expect(normalizeIngredientName('   ')).toBe('')
  })
})
