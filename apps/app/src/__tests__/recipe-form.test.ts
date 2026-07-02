import { describe, it, expect } from 'vitest'
import { buildPayload, validatePayload, recipeToFormState } from '../utils/recipeForm'
import type { IngredientRow, StepRow } from '../utils/recipeForm'
import type { Recipe } from '@recetario/shared'

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

  it('includes dietaryTags when non-empty', () => {
    const result = buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps, [
      'vegano',
    ])
    expect(result.dietaryTags).toEqual(['vegano'])
  })

  it('omits dietaryTags when empty array', () => {
    const result = buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps, [])
    expect(result.dietaryTags).toBeUndefined()
  })

  it('omits dietaryTags when undefined', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      undefined,
    )
    expect(result.dietaryTags).toBeUndefined()
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

  it('returns category error for invalid category', () => {
    const payload = {
      ...buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps),
      category: 'Brunch' as never,
    }
    const { valid, errors } = validatePayload(payload)
    expect(valid).toBe(false)
    expect(errors.category ?? errors.general).toBeDefined()
  })

  it('sets errors.general for validation errors on unrecognized paths', () => {
    const payload = buildPayload(
      'Receta',
      '4',
      'Cena',
      '',
      '',
      [{ name: 'Harina', quantity: '200', unit: 'g', presentation: '' }],
      [],
    )
    // Force a Zod issue on an unknown path by corrupting the payload type
    const corrupted = { ...payload, steps: 'not-an-array' }
    const { valid, errors } = validatePayload(
      corrupted as unknown as Parameters<typeof validatePayload>[0],
    )
    expect(valid).toBe(false)
    expect(errors.general).toBeDefined()
  })
})

describe('recipeToFormState', () => {
  const recipe: Recipe = {
    title: 'Pasta',
    servings: 4,
    category: 'Cena',
    tags: ['italiana', 'rápida'],
    images: [],
    originalLanguage: 'es',
    translations: [],
    notes: 'Al dente',
    ingredients: [
      { name: 'Pasta', quantity: 200, unit: 'g' },
      { name: 'Sal', quantity: null, unit: null, presentation: 'fina' },
    ],
    steps: [{ text: 'Hervir' }, { text: 'Escurrir' }],
  }

  it('maps recipe to form state', () => {
    const form = recipeToFormState(recipe)
    expect(form.title).toBe('Pasta')
    expect(form.servings).toBe('4')
    expect(form.category).toBe('Cena')
    expect(form.tags).toBe('italiana, rápida')
    expect(form.notes).toBe('Al dente')
  })

  it('converts null quantity to empty string', () => {
    const form = recipeToFormState(recipe)
    expect(form.ingredients[1]?.quantity).toBe('')
  })

  it('converts null unit to empty string', () => {
    const form = recipeToFormState(recipe)
    expect(form.ingredients[1]?.unit).toBe('')
  })

  it('converts numeric quantity to string', () => {
    const form = recipeToFormState(recipe)
    expect(form.ingredients[0]?.quantity).toBe('200')
  })

  it('maps presentation or defaults to empty string', () => {
    const form = recipeToFormState(recipe)
    expect(form.ingredients[0]?.presentation).toBe('')
    expect(form.ingredients[1]?.presentation).toBe('fina')
  })

  it('maps steps to text rows', () => {
    const form = recipeToFormState(recipe)
    expect(form.steps).toEqual([{ text: 'Hervir' }, { text: 'Escurrir' }])
  })

  it('handles null notes', () => {
    const form = recipeToFormState({ ...recipe, notes: undefined })
    expect(form.notes).toBe('')
  })
})
