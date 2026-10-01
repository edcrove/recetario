import { describe, it, expect } from 'vitest'
import { bestVolumeUnit, convertUnit } from './units.js'
import { aggregateIngredients } from './shopping.js'
import { dietaryStatus } from './dietary.js'

// Cases added after mutation testing (2026-10-01): each one fails when a
// boundary or condition in these helpers is shifted, which the earlier tests
// let through.

describe('bestVolumeUnit boundaries', () => {
  it('metric switches to liters at exactly 1000 ml', () => {
    expect(bestVolumeUnit(999, 'metric')).toBe('ml')
    expect(bestVolumeUnit(1000, 'metric')).toBe('l')
  })
  it('imperial: under a tablespoon is teaspoons, under 1/4 cup is tablespoons', () => {
    expect(bestVolumeUnit(14.9, 'imperial')).toBe('tsp')
    expect(bestVolumeUnit(15, 'imperial')).toBe('tbsp')
    expect(bestVolumeUnit(59.9, 'imperial')).toBe('tbsp')
    expect(bestVolumeUnit(60, 'imperial')).toBe('cup')
  })
})

describe('convertUnit passes through what it cannot convert', () => {
  it('same unit, a missing unit, or crossing dimensions keeps the quantity', () => {
    expect(convertUnit(3, 'cup', 'cup')).toBe(3)
    expect(convertUnit(3, null, 'ml')).toBe(3)
    expect(convertUnit(3, 'ml', null)).toBe(3)
    expect(convertUnit(250, 'g', 'ml')).toBe(250)
    expect(convertUnit(2, 'unit', 'g')).toBe(2)
  })
  it('converts within volume and within mass', () => {
    expect(convertUnit(2, 'tbsp', 'tsp')).toBe(6)
    expect(convertUnit(1.5, 'kg', 'g')).toBe(1500)
  })
})

describe('shopping merge across mass and volume', () => {
  it('harina in grams and cups becomes one line in grams (density known)', () => {
    const list = aggregateIngredients([
      { name: 'harina', quantity: 100, unit: 'g' },
      { name: 'harina', quantity: 1, unit: 'cup' },
    ])
    expect(list).toEqual([{ ingredient: 'harina', quantity: 227.2, unit: 'g' }])
  })

  it('without a density the two lines stay apart', () => {
    const list = aggregateIngredients([
      { name: 'salsa misteriosa', quantity: 100, unit: 'g' },
      { name: 'salsa misteriosa', quantity: 1, unit: 'cup' },
    ])
    expect(list).toEqual([
      { ingredient: 'salsa misteriosa', quantity: 100, unit: 'g' },
      { ingredient: 'salsa misteriosa', quantity: 240, unit: 'ml' },
    ])
  })

  it('only masses (density known) sum into one gram line', () => {
    const list = aggregateIngredients([
      { name: 'harina', quantity: 1, unit: 'kg' },
      { name: 'harina', quantity: 250, unit: 'g' },
    ])
    expect(list).toEqual([{ ingredient: 'harina', quantity: 1250, unit: 'g' }])
  })

  it('an "a gusto" line in the same unit keeps the measured amount (in either order)', () => {
    const measuredFirst = aggregateIngredients([
      { name: 'harina', quantity: 100, unit: 'g' },
      { name: 'harina', quantity: null, unit: 'g' },
    ])
    const toTasteFirst = aggregateIngredients([
      { name: 'harina', quantity: null, unit: 'g' },
      { name: 'harina', quantity: 100, unit: 'g' },
    ])
    expect(measuredFirst).toEqual([{ ingredient: 'harina', quantity: 100, unit: 'g' }])
    expect(toTasteFirst).toEqual([{ ingredient: 'harina', quantity: 100, unit: 'g' }])
    expect(
      aggregateIngredients([
        { name: 'sal', quantity: null, unit: null },
        { name: 'sal', quantity: null, unit: null },
      ]),
    ).toEqual([{ ingredient: 'sal', quantity: null, unit: null }])
  })
})

describe('dietaryStatus', () => {
  it('one meat ingredient among many breaks vegetariano', () => {
    const recipe = {
      ingredients: [{ name: 'Lentejas' }, { name: 'Chorizo' }, { name: 'Cebolla' }],
      dietaryTags: ['vegetariano'],
    }
    expect(dietaryStatus(recipe, 'vegetariano')).toBe('no-cumple')
  })
})
