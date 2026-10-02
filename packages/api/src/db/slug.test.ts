import { describe, it, expect } from 'vitest'
import { isUsableSlug, replaceTag, slugify, tagEntries } from './slug.js'

describe('slugify', () => {
  it('lowercases, dashes whitespace runs and drops non-ASCII', () => {
    expect(slugify('Comida  Rápida')).toBe('comida-rpida')
    expect(slugify('Sin-Gluten 2')).toBe('sin-gluten-2')
  })
})

describe('isUsableSlug', () => {
  it('needs at least one letter or digit', () => {
    expect(isUsableSlug('a')).toBe(true)
    expect(isUsableSlug('-9-')).toBe(true)
    expect(isUsableSlug('--')).toBe(false)
    expect(isUsableSlug('')).toBe(false)
  })
})

describe('tagEntries', () => {
  it('trims, keeps one spelling per slug (the first) and skips unusable ones', () => {
    expect(tagEntries(['  Rápido ', 'rápido', 'RÁPIDO', 'ñ', '  ', 'Al horno'])).toEqual([
      { name: 'Rápido', slug: 'rpido' },
      { name: 'Al horno', slug: 'al-horno' },
    ])
  })
  it('is empty for no tags', () => {
    expect(tagEntries([])).toEqual([])
  })
})

describe('replaceTag', () => {
  it('renames every spelling of the slug and keeps the rest in order', () => {
    expect(replaceTag(['a', ' Rápido', 'b'], 'rpido', 'Veloz')).toEqual(['a', 'Veloz', 'b'])
  })
  it('drops the tag when the new name is null', () => {
    expect(replaceTag(['a', 'rápido', 'Rápido'], 'rpido', null)).toEqual(['a'])
  })
  it('keeps one spelling per slug after a merge into an existing tag', () => {
    expect(replaceTag(['rapido', 'rápido'], 'rpido', 'rapido')).toEqual(['rapido'])
    expect(replaceTag(['rápido', 'rapido'], 'rpido', 'rapido')).toEqual(['rapido'])
  })
  it('leaves unrelated lists untouched', () => {
    expect(replaceTag(['x', 'y'], 'z', 'w')).toEqual(['x', 'y'])
  })
})
