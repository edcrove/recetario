import { describe, it, expect } from 'vitest'
import {
  buildPayload,
  categoryOptions,
  parseQuantity,
  validatePayload,
  recipeToFormState,
} from '../utils/recipeForm'
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

  // Auditar 2026-09-30: [] was turned into undefined ("leave unchanged"), so
  // unticking the last diet chip on an edit kept the old tag.
  it('sends an empty dietaryTags list so an edit can clear the last one', () => {
    const result = buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps, [])
    expect(result.dietaryTags).toEqual([])
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

  // Regression tests for the 2026-07-03 audit finding: foodTypeIds used to be
  // collected by the UI but silently never sent anywhere.
  it('includes foodTypeIds when non-empty', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      undefined,
      ['ft-1', 'ft-2'],
    )
    expect(result.foodTypeIds).toEqual(['ft-1', 'ft-2'])
  })

  it('sends an empty foodTypeIds list so an edit can clear the last one', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      undefined,
      [],
    )
    expect(result.foodTypeIds).toEqual([])
  })

  it('omits foodTypeIds when undefined', () => {
    const result = buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps)
    expect(result.foodTypeIds).toBeUndefined()
  })

  it('parses prep/cook minutes and computes total time', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      [],
      [],
      {
        prepTimeMin: '10',
        cookTimeMin: '15',
        difficulty: 'media',
      },
    )
    expect(result.prepTimeMin).toBe(10)
    expect(result.cookTimeMin).toBe(15)
    expect(result.totalTimeMin).toBe(25)
    expect(result.difficulty).toBe('media')
  })

  // Auditar 2026-10-03: seed and MCP recipes store only a total; saving the
  // edit form without touching the times sent totalTimeMin: null and erased it.
  it('keeps a stored total while prep and cook stay blank', () => {
    const times = { prepTimeMin: '', cookTimeMin: '', difficulty: null, totalTimeMin: '45' }
    const result = buildPayload(
      'T',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      [],
      [],
      times,
    )
    expect(result).toMatchObject({ prepTimeMin: null, cookTimeMin: null, totalTimeMin: 45 })
  })

  it('a prep or cook time replaces the stored total with their sum', () => {
    const times = { prepTimeMin: '10', cookTimeMin: '', difficulty: null, totalTimeMin: '45' }
    const result = buildPayload(
      'T',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      [],
      [],
      times,
    )
    expect(result.totalTimeMin).toBe(10)
  })

  // Clearing cook (prep kept) must null cookTimeMin AND recompute a consistent
  // total — never omit cook and leave a stale value + desynced total on edit.
  it('nulls a cleared cook time and keeps total consistent with prep only', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      [],
      [],
      {
        prepTimeMin: '20',
        cookTimeMin: '',
        difficulty: null,
      },
    )
    expect(result.prepTimeMin).toBe(20)
    expect(result.cookTimeMin).toBeNull()
    expect(result.totalTimeMin).toBe(20)
  })

  it('nulls a cleared prep time and keeps total consistent with cook only', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      [],
      [],
      {
        prepTimeMin: '',
        cookTimeMin: '30',
        difficulty: null,
      },
    )
    expect(result.prepTimeMin).toBeNull()
    expect(result.cookTimeMin).toBe(30)
    expect(result.totalTimeMin).toBe(30)
  })

  // Blank form with a times object = an edit clearing everything → explicit null
  // for every field so the partial update actually unsets them (not omitted).
  it('sends explicit null for all time/difficulty fields when blank (clears on edit)', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      [],
      [],
      {
        prepTimeMin: '',
        cookTimeMin: '',
        difficulty: null,
      },
    )
    expect(result.prepTimeMin).toBeNull()
    expect(result.cookTimeMin).toBeNull()
    expect(result.totalTimeMin).toBeNull()
    expect(result.difficulty).toBeNull()
  })

  it('treats non-positive minute values as cleared (null)', () => {
    const result = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      '',
      validIngredients,
      validSteps,
      [],
      [],
      {
        prepTimeMin: '0',
        cookTimeMin: 'abc',
        difficulty: null,
      },
    )
    expect(result.prepTimeMin).toBeNull()
    expect(result.cookTimeMin).toBeNull()
    expect(result.totalTimeMin).toBeNull()
  })

  // No times object (e.g. a caller that doesn't touch times) → fields omitted
  // entirely, i.e. "leave unchanged" on a partial update.
  it('omits all time fields when no times object is passed', () => {
    const result = buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps)
    expect(result.prepTimeMin).toBeUndefined()
    expect(result.cookTimeMin).toBeUndefined()
    expect(result.totalTimeMin).toBeUndefined()
    expect(result.difficulty).toBeUndefined()
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

  it('returns a category error for a blank category (custom names are checked by the API)', () => {
    const payload = {
      ...buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps),
      category: '  ',
    }
    const { valid, errors } = validatePayload(payload)
    expect(valid).toBe(false)
    expect(errors.category).toBeDefined()
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

  it('carries a total-only time so a save keeps it', () => {
    expect(recipeToFormState({ ...recipe, totalTimeMin: 45 }).totalTimeMin).toBe('45')
  })

  it('leaves the total out when prep or cook exist (it is their sum)', () => {
    const form = recipeToFormState({
      ...recipe,
      prepTimeMin: 10,
      cookTimeMin: 20,
      totalTimeMin: 30,
    })
    expect(form).toMatchObject({ prepTimeMin: '10', cookTimeMin: '20', totalTimeMin: '' })
    expect(recipeToFormState(recipe).totalTimeMin).toBe('')
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

  it('maps diet tags, defaulting to none', () => {
    expect(recipeToFormState(recipe).dietaryTags).toEqual([])
    expect(recipeToFormState({ ...recipe, dietaryTags: ['vegano'] }).dietaryTags).toEqual([
      'vegano',
    ])
  })

  it('maps food types and visibility, defaulting to none and private', () => {
    expect(recipeToFormState(recipe).foodTypeIds).toEqual([])
    expect(recipeToFormState(recipe).visibility).toBe('private')
    const form = recipeToFormState({ ...recipe, foodTypeIds: ['ft-1'], visibility: 'public' })
    expect(form.foodTypeIds).toEqual(['ft-1'])
    expect(form.visibility).toBe('public')
  })

  it('handles null notes', () => {
    const form = recipeToFormState({ ...recipe, notes: undefined })
    expect(form.notes).toBe('')
  })

  it('maps times and difficulty to form state', () => {
    const form = recipeToFormState({
      ...recipe,
      prepTimeMin: 10,
      cookTimeMin: 15,
      difficulty: 'fácil',
    })
    expect(form.prepTimeMin).toBe('10')
    expect(form.cookTimeMin).toBe('15')
    expect(form.difficulty).toBe('fácil')
  })

  it('defaults times to empty strings and difficulty to null when absent', () => {
    const form = recipeToFormState(recipe)
    expect(form.prepTimeMin).toBe('')
    expect(form.cookTimeMin).toBe('')
    expect(form.difficulty).toBeNull()
  })
})

describe('categoryOptions', () => {
  const SYSTEM = ['Desayuno', 'Almuerzo', 'Cena', 'Postre', 'Snack', 'Bebida', 'Otro']

  it('is the system categories, in their usual order, until the account loads', () => {
    expect(categoryOptions(undefined, 'Cena')).toEqual(SYSTEM)
  })

  it("adds the account's own categories after the system ones (never twice)", () => {
    const loaded = [
      { name: 'Almuerzo', isSystem: true },
      { name: 'Comida rápida', isSystem: false },
      { name: 'Cena', isSystem: true },
      { name: 'Viandas' },
    ]
    expect(categoryOptions(loaded, 'Cena')).toEqual([...SYSTEM, 'Comida rápida', 'Viandas'])
  })

  it("always offers the recipe's current category", () => {
    expect(categoryOptions(undefined, 'Comida rápida')).toEqual([...SYSTEM, 'Comida rápida'])
    expect(categoryOptions([{ name: 'Viandas' }], 'Viandas')).toEqual([...SYSTEM, 'Viandas'])
  })
})

// 2026-10-02 review: quantities went through parseFloat, which read the
// decimal comma used here ("1,5") and fractions ("1/2") as 1 — silently.
describe('parseQuantity', () => {
  it.each([
    ['1,5', 1.5],
    ['0,25', 0.25],
    ['1.5', 1.5],
    ['200', 200],
    [' 3 ', 3],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['2 3/4', 2.75],
    ['½', 0.5],
    ['1½', 1.5],
    ['1 ¼', 1.25],
    ['⅔', 2 / 3],
    ['.5', 0.5],
    ['12½', 12.5],
    ['10 1/2', 10.5],
    ['1  1/2', 1.5],
    ['10/4', 2.5],
    ['1/10', 0.1],
  ])('reads %j as %d', (text, value) => {
    expect(parseQuantity(text)).toBeCloseTo(value)
  })

  it('blank is "a gusto" (null); anything else is NaN, never a wrong number', () => {
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('   ')).toBeNull()
    for (const bad of [
      'un poco',
      '1,5kg',
      '1..5',
      '1/',
      '2-3',
      '1,2,3',
      'x½',
      '½x',
      'a1/2',
      '1/2a',
    ])
      expect(parseQuantity(bad)).toBeNaN()
  })

  it('an unreadable or zero quantity gets a Spanish message naming the ingredient', () => {
    for (const quantity of ['un poco', '0', '1/0']) {
      const payload = buildPayload(
        'Torta',
        '4',
        'Postre',
        '',
        '',
        [validIngredients[0]!, { name: 'Leche', quantity, unit: 'ml', presentation: '' }],
        validSteps,
      )
      expect(validatePayload(payload).errors.ingredients).toBe(
        'Revisá la cantidad del ingrediente 2: usá un número como 2, 1,5 o 1/2.',
      )
    }
  })

  it('other ingredient or form errors keep their own message', () => {
    const none = validatePayload(buildPayload('Torta', '4', 'Postre', '', '', [], validSteps))
    expect(none.errors.ingredients).toBeDefined()
    expect(none.errors.ingredients).not.toMatch(/Revisá la cantidad/)
    const longName = validatePayload(
      buildPayload(
        'Torta',
        '4',
        'Postre',
        '',
        '',
        [{ name: 'x'.repeat(201), quantity: '1', unit: '', presentation: '' }],
        validSteps,
      ),
    )
    expect(longName.errors.ingredients).not.toMatch(/Revisá la cantidad/)
    const steps = validatePayload({
      ...buildPayload('Torta', '4', 'Postre', '', '', validIngredients, validSteps),
      steps: 'x',
    } as unknown as Parameters<typeof validatePayload>[0])
    expect(steps.errors.general).toBeDefined()
    expect(steps.errors.ingredients).toBeUndefined()
  })

  it('the payload carries 1,5 as 1.5', () => {
    const payload = buildPayload(
      'Torta',
      '4',
      'Postre',
      '',
      '',
      [{ name: 'Harina', quantity: '1,5', unit: 'kg', presentation: '' }],
      validSteps,
    )
    expect(payload.ingredients[0]?.quantity).toBe(1.5)
  })
})
