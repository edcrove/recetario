import { describe, it, expect } from 'vitest'
import { buildPayload, validatePayload } from '../utils/recipeForm'
import type { IngredientRow, StepRow } from '../utils/recipeForm'

const validIngredients: IngredientRow[] = [
  { name: 'Harina', quantity: '200', unit: 'g', presentation: '' },
]
const validSteps: StepRow[] = [{ text: 'Mezclar' }]

describe('buildPayload', () => {
  it('builds a valid payload from form state', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      'dulce, horno',
      '',
      validIngredients,
      validSteps,
    )
    expect(result.title).toBe('Torta')
    expect(result.servings).toBe(4)
    expect(result.category).toBe('Postre')
    expect(result.tags).toEqual(['dulce', 'horno'])
    expect(result.ingredients).toHaveLength(1)
    expect(result.steps).toHaveLength(1)
  })

  it('trims whitespace from title', () => {
    const result = buildPayload('  Torta  ', '4', 'Postre', '', '', validIngredients, validSteps)
    expect(result.title).toBe('Torta')
  })

  it('falls back to 0 for non-numeric servings', () => {
    const result = buildPayload('Torta', 'abc', 'Postre', '', '', validIngredients, validSteps)
    expect(result.servings).toBe(0)
  })

  it('parseInt handles empty string', () => {
    const result = buildPayload('Torta', '', 'Postre', '', '', validIngredients, validSteps)
    expect(result.servings).toBe(0)
  })

  it('filters empty ingredient rows', () => {
    const ings: IngredientRow[] = [
      { name: 'Harina', quantity: '200', unit: 'g', presentation: '' },
      { name: '', quantity: '', unit: '', presentation: '' },
      { name: '  ', quantity: '', unit: '', presentation: '' },
    ]
    const result = buildPayload('Torta', '4', 'Postre', '', '', ings, validSteps)
    expect(result.ingredients).toHaveLength(1)
  })

  it('converts empty unit to null', () => {
    const ings: IngredientRow[] = [{ name: 'Huevos', quantity: '3', unit: '', presentation: '' }]
    const result = buildPayload('Torta', '4', 'Postre', '', '', ings, validSteps)
    expect(result.ingredients[0]?.unit).toBeNull()
  })

  it('converts empty quantity to null', () => {
    const ings: IngredientRow[] = [{ name: 'Sal', quantity: '', unit: '', presentation: '' }]
    const result = buildPayload('Torta', '4', 'Postre', '', '', ings, validSteps)
    expect(result.ingredients[0]?.quantity).toBeNull()
  })

  it('filters empty step rows', () => {
    const steps: StepRow[] = [{ text: 'Mezclar' }, { text: '' }, { text: '  ' }]
    const result = buildPayload('Torta', '4', 'Postre', '', '', validIngredients, steps)
    expect(result.steps).toHaveLength(1)
  })

  it('sets notes to undefined when empty', () => {
    const result = buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps)
    expect(result.notes).toBeUndefined()
  })

  it('preserves notes when provided', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      'Hornear lento',
      validIngredients,
      validSteps,
    )
    expect(result.notes).toBe('Hornear lento')
  })

  it('splits tags by comma and trims', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      ' dulce , horno , ',
      '',
      validIngredients,
      validSteps,
    )
    expect(result.tags).toEqual(['dulce', 'horno'])
  })

  it('converts presentation to undefined when empty', () => {
    const result = buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps)
    expect(result.ingredients[0]?.presentation).toBeUndefined()
  })
})

describe('validatePayload', () => {
  it('returns valid for a correct payload', () => {
    const payload = buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps)
    const { valid, errors } = validatePayload(payload)
    expect(valid).toBe(true)
    expect(errors).toEqual({})
  })

  it('returns title error for empty title', () => {
    const payload = buildPayload('', '4', 'Postre', '', '', validIngredients, validSteps)
    const { valid, errors } = validatePayload(payload)
    expect(valid).toBe(false)
    expect(errors.title).toBeDefined()
  })

  it('returns servings error for 0 servings', () => {
    const payload = buildPayload('Torta', '0', 'Postre', '', '', validIngredients, validSteps)
    const { valid, errors } = validatePayload(payload)
    expect(valid).toBe(false)
    expect(errors.servings).toBeDefined()
  })

  it('returns ingredients error for empty ingredients', () => {
    const payload = buildPayload('Torta', '4', 'Postre', '', '', [], validSteps)
    const { valid, errors } = validatePayload(payload)
    expect(valid).toBe(false)
    expect(errors.ingredients).toBeDefined()
  })
})
