import { describe, expect, it } from 'vitest'
import {
  CategorySchema,
  CreateRecipeSchema,
  IngredientSchema,
  RecipeSchema,
  SourceSchema,
  StepSchema,
  TranslationSchema,
  UnitSchema,
  UpdateRecipeSchema,
} from './schema.js'

const validIngredient = {
  name: 'Flour',
  quantity: 2,
  unit: 'cup',
}

const validRecipe = {
  title: 'Chocolate Cake',
  servings: 8,
  category: 'Postre',
  ingredients: [validIngredient],
}

describe('UnitSchema', () => {
  it('parses valid units', () => {
    expect(UnitSchema.parse('cup')).toBe('cup')
    expect(UnitSchema.parse('g')).toBe('g')
    expect(UnitSchema.parse('tsp')).toBe('tsp')
  })

  it('fails on invalid unit', () => {
    expect(() => UnitSchema.parse('oz')).toThrow()
    expect(() => UnitSchema.parse('lb')).toThrow()
  })
})

describe('CategorySchema', () => {
  it('parses valid categories', () => {
    expect(CategorySchema.parse('Desayuno')).toBe('Desayuno')
    expect(CategorySchema.parse('Postre')).toBe('Postre')
  })

  it('fails on invalid category', () => {
    expect(() => CategorySchema.parse('Breakfast')).toThrow()
    expect(() => CategorySchema.parse('dessert')).toThrow()
  })
})

describe('SourceSchema', () => {
  it('accepts valid source with url', () => {
    const result = SourceSchema.parse({ type: 'url', url: 'https://example.com/recipe' })
    expect(result.type).toBe('url')
    expect(result.url).toBe('https://example.com/recipe')
  })

  it('rejects invalid type', () => {
    expect(() => SourceSchema.parse({ type: 'pdf' })).toThrow()
  })

  it('rejects invalid url format', () => {
    expect(() => SourceSchema.parse({ type: 'url', url: 'not-a-url' })).toThrow()
  })

  it('accepts source without url (manual/photo)', () => {
    expect(() => SourceSchema.parse({ type: 'manual' })).not.toThrow()
    expect(() => SourceSchema.parse({ type: 'photo' })).not.toThrow()
  })
})

describe('StepSchema', () => {
  it('accepts valid step with duration', () => {
    const result = StepSchema.parse({ text: 'Mix well', durationMin: 5 })
    expect(result.text).toBe('Mix well')
    expect(result.durationMin).toBe(5)
  })

  it('rejects empty text', () => {
    expect(() => StepSchema.parse({ text: '' })).toThrow()
  })

  it('rejects negative durationMin', () => {
    expect(() => StepSchema.parse({ text: 'Mix', durationMin: -1 })).toThrow()
  })

  it('rejects zero durationMin', () => {
    expect(() => StepSchema.parse({ text: 'Mix', durationMin: 0 })).toThrow()
  })

  it('accepts step with ovenTempC', () => {
    const result = StepSchema.parse({ text: 'Bake', ovenTempC: 180 })
    expect(result.ovenTempC).toBe(180)
  })
})

describe('TranslationSchema', () => {
  it('accepts valid 2-char language', () => {
    const result = TranslationSchema.parse({ language: 'es', title: 'Torta' })
    expect(result.language).toBe('es')
  })

  it('accepts valid 5-char language (BCP-47)', () => {
    const result = TranslationSchema.parse({ language: 'pt-BR' })
    expect(result.language).toBe('pt-BR')
  })

  it('rejects 1-char language', () => {
    expect(() => TranslationSchema.parse({ language: 'e' })).toThrow()
  })

  it('rejects 6-char language', () => {
    expect(() => TranslationSchema.parse({ language: 'toolng' })).toThrow()
  })
})

describe('IngredientSchema', () => {
  it('parses ingredient with null quantity and null unit', () => {
    const result = IngredientSchema.parse({
      name: 'Salt',
      quantity: null,
      unit: null,
    })
    expect(result.quantity).toBeNull()
    expect(result.unit).toBeNull()
  })
})

describe('RecipeSchema', () => {
  it('parses a valid full recipe', () => {
    const result = RecipeSchema.parse({
      ...validRecipe,
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      tags: ['chocolate', 'dessert'],
      prepTimeMin: 20,
      cookTimeMin: 40,
      images: ['https://example.com/image.jpg'],
      notes: 'Great recipe!',
      yield: '1 cake',
      originalLanguage: 'es',
      translations: [{ language: 'en', title: 'Chocolate Cake' }],
      steps: [{ text: 'Mix ingredients', durationMin: 10 }],
      source: { type: 'url', url: 'https://example.com/recipe' },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    })
    expect(result.title).toBe('Chocolate Cake')
    expect(result.servings).toBe(8)
    expect(result.category).toBe('Postre')
  })

  it('parses recipe with null quantity and null unit on ingredient', () => {
    const result = RecipeSchema.parse({
      ...validRecipe,
      ingredients: [{ name: 'Salt', quantity: null, unit: null }],
    })
    expect(result.ingredients[0]?.quantity).toBeNull()
    expect(result.ingredients[0]?.unit).toBeNull()
  })

  it('applies defaults for missing optional arrays', () => {
    const result = RecipeSchema.parse(validRecipe)
    expect(result.tags).toEqual([])
    expect(result.images).toEqual([])
    expect(result.translations).toEqual([])
    expect(result.steps).toEqual([])
    expect(result.originalLanguage).toBe('es')
  })

  it('fails when title is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { title: _title, ...noTitle } = validRecipe
    expect(() => RecipeSchema.parse(noTitle)).toThrow()
  })

  it('fails when ingredients is empty', () => {
    expect(() => RecipeSchema.parse({ ...validRecipe, ingredients: [] })).toThrow()
  })

  it('fails with invalid category', () => {
    expect(() => RecipeSchema.parse({ ...validRecipe, category: 'Brunch' })).toThrow()
  })

  it('fails with invalid unit in ingredient', () => {
    expect(() =>
      RecipeSchema.parse({
        ...validRecipe,
        ingredients: [{ name: 'Flour', quantity: 2, unit: 'oz' }],
      }),
    ).toThrow()
  })
})

describe('CreateRecipeSchema', () => {
  it('strips id, createdAt, updatedAt fields', () => {
    const input = {
      ...validRecipe,
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    }
    const result = CreateRecipeSchema.parse(input)
    expect('id' in result).toBe(false)
    expect('createdAt' in result).toBe(false)
    expect('updatedAt' in result).toBe(false)
  })
})

describe('UpdateRecipeSchema', () => {
  it('allows partial updates (all fields optional)', () => {
    const result = UpdateRecipeSchema.parse({ title: 'Updated Title' })
    expect(result.title).toBe('Updated Title')
  })

  it('parses empty object (defaults still applied for defaulted fields)', () => {
    const result = UpdateRecipeSchema.parse({})
    // defaults from .default() are still applied even in partial; no required fields
    expect(result.title).toBeUndefined()
    expect(result.servings).toBeUndefined()
    expect(result.category).toBeUndefined()
  })
})
