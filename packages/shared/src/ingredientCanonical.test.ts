import { describe, it, expect } from 'vitest'
import {
  stripPresentation,
  normalizeIngredientKey,
  resolveCanonical,
  PRESENTATION_WORDS,
} from './ingredientCanonical.js'

describe('stripPresentation', () => {
  it('drops single presentation words', () => {
    expect(stripPresentation('pollo picado')).toBe('pollo')
    expect(stripPresentation('zanahoria rallada')).toBe('zanahoria')
    expect(stripPresentation('tomate triturado')).toBe('tomate')
    expect(stripPresentation('huevo cocido')).toBe('huevo')
  })

  it('drops multi-word presentation phrases and their orphaned connectors', () => {
    // Input is already normalized (singular) — the plural forms go through
    // normalizeIngredientKey below.
    expect(stripPresentation('cebolla en juliana')).toBe('cebolla')
    expect(stripPresentation('papa en cubo')).toBe('papa')
    expect(stripPresentation('morron en tira')).toBe('morron')
    expect(stripPresentation('ajo en polvo')).toBe('ajo')
  })

  it('keeps meaningful "de" phrases intact', () => {
    expect(stripPresentation('pata de pollo')).toBe('pata de pollo')
    expect(stripPresentation('diente de ajo')).toBe('diente de ajo')
  })

  it('collapses to empty when only presentation words remain', () => {
    expect(stripPresentation('picado')).toBe('')
  })
})

describe('normalizeIngredientKey', () => {
  it('runs the full pipeline: lowercase, de-accent, singularize, strip presentation', () => {
    expect(normalizeIngredientKey('Pechugas de Pollo')).toBe('pechuga de pollo')
    expect(normalizeIngredientKey('Cebollas en Juliana')).toBe('cebolla')
    expect(normalizeIngredientKey('  TOMATES triturados ')).toBe('tomate')
    expect(normalizeIngredientKey('Papas en cubos')).toBe('papa')
    expect(normalizeIngredientKey('Zanahorias ralladas')).toBe('zanahoria')
  })
})

describe('resolveCanonical', () => {
  const synonyms = new Map<string, string>([
    ['suprema de pollo', 'pollo'],
    ['pechuga de pollo', 'pollo'],
    ['pechuga', 'pollo'],
    ['cebolla morada', 'cebolla'],
  ])
  const canonicals = new Set(['pollo', 'muslo de pollo', 'cebolla'])

  it('maps a synonym to its canonical key', () => {
    expect(resolveCanonical('Suprema de pollo', synonyms, canonicals).key).toBe('pollo')
    expect(resolveCanonical('pechugas', synonyms, canonicals).key).toBe('pollo')
  })

  it('returns a canonical unchanged when the name is already canonical', () => {
    const r = resolveCanonical('Muslo de pollo', synonyms, canonicals)
    expect(r.key).toBe('muslo de pollo')
    expect(r.matched).toBe(true)
  })

  it('passes through an unknown name using its normalized key', () => {
    const r = resolveCanonical('Berenjena', synonyms, canonicals)
    expect(r.key).toBe('berenjena')
    expect(r.matched).toBe(false)
  })

  it('strips presentation before resolving', () => {
    expect(resolveCanonical('pechuga rallada', synonyms, canonicals).key).toBe('pollo')
  })
})

describe('PRESENTATION_WORDS', () => {
  it('is a non-empty set of normalized words', () => {
    expect(PRESENTATION_WORDS.size).toBeGreaterThan(5)
    expect(PRESENTATION_WORDS.has('picado')).toBe(true)
  })
})
