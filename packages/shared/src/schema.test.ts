import { describe, expect, it } from 'vitest'
import {
  CategorySchema,
  SYSTEM_CATEGORIES,
  CreateRecipeSchema,
  IngredientSchema,
  RecipeSchema,
  SourceSchema,
  StepSchema,
  TranslationSchema,
  UnitSchema,
  UpdateRecipeSchema,
  NutritionTargetsSchema,
  DEFAULT_NUTRITION_TARGETS,
  atwaterKcal,
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
  it('accepts system and custom names, trimmed (the API checks they exist)', () => {
    expect(CategorySchema.parse('Desayuno')).toBe('Desayuno')
    expect(CategorySchema.parse('  Comida rápida ')).toBe('Comida rápida')
    expect(CategorySchema.parse('x'.repeat(50))).toHaveLength(50)
  })

  it('rejects blank or too long names', () => {
    expect(() => CategorySchema.parse('')).toThrow()
    expect(() => CategorySchema.parse('   ')).toThrow()
    expect(() => CategorySchema.parse('x'.repeat(51))).toThrow()
  })
})

describe('SYSTEM_CATEGORIES', () => {
  it('lists the seven categories every account starts with', () => {
    expect(SYSTEM_CATEGORIES).toEqual([
      'Desayuno',
      'Almuerzo',
      'Cena',
      'Postre',
      'Snack',
      'Bebida',
      'Otro',
    ])
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

  it('rejects non-http(s) schemes that could run script when opened', () => {
    for (const url of [
      'javascript:alert(document.domain)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ]) {
      expect(SourceSchema.safeParse({ type: 'url', url }).success).toBe(false)
    }
    expect(SourceSchema.safeParse({ type: 'url', url: 'http://example.com' }).success).toBe(true)
  })

  it('accepts source without url (manual/photo)', () => {
    expect(() => SourceSchema.parse({ type: 'manual' })).not.toThrow()
    expect(() => SourceSchema.parse({ type: 'photo' })).not.toThrow()
  })
})

describe('StepSchema', () => {
  it('accepts valid step with duration', () => {
    const result = StepSchema.parse({ text: 'Mix well', durationSeconds: 300 })
    expect(result.text).toBe('Mix well')
    expect(result.durationSeconds).toBe(300)
  })

  it('rejects empty text', () => {
    expect(() => StepSchema.parse({ text: '' })).toThrow()
  })

  it('rejects negative durationSeconds', () => {
    expect(() => StepSchema.parse({ text: 'Mix', durationSeconds: -1 })).toThrow()
  })

  it('rejects zero durationSeconds', () => {
    expect(() => StepSchema.parse({ text: 'Mix', durationSeconds: 0 })).toThrow()
  })

  it('rejects non-integer durationSeconds', () => {
    expect(() => StepSchema.parse({ text: 'Mix', durationSeconds: 1.5 })).toThrow()
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
      steps: [{ text: 'Mix ingredients', durationSeconds: 600 }],
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
    const { title: _title, ...noTitle } = validRecipe
    expect(() => RecipeSchema.parse(noTitle)).toThrow()
  })

  it('fails when ingredients is empty', () => {
    expect(() => RecipeSchema.parse({ ...validRecipe, ingredients: [] })).toThrow()
  })

  it('fails with a blank category', () => {
    expect(() => RecipeSchema.parse({ ...validRecipe, category: ' ' })).toThrow()
  })

  it('fails with invalid unit in ingredient', () => {
    expect(() =>
      RecipeSchema.parse({
        ...validRecipe,
        ingredients: [{ name: 'Flour', quantity: 2, unit: 'oz' }],
      }),
    ).toThrow()
  })

  it('accepts visibility private and public', () => {
    expect(RecipeSchema.parse({ ...validRecipe, visibility: 'private' }).visibility).toBe('private')
    expect(RecipeSchema.parse({ ...validRecipe, visibility: 'public' }).visibility).toBe('public')
  })

  it('leaves visibility undefined when omitted (DB defaults it to private)', () => {
    expect(RecipeSchema.parse(validRecipe).visibility).toBeUndefined()
  })

  it('rejects invalid visibility values', () => {
    expect(() => RecipeSchema.parse({ ...validRecipe, visibility: 'household' })).toThrow()
  })

  it('accepts forkedFromId as uuid or null, rejects malformed ids', () => {
    expect(
      RecipeSchema.parse({
        ...validRecipe,
        forkedFromId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      }).forkedFromId,
    ).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
    expect(RecipeSchema.parse({ ...validRecipe, forkedFromId: null }).forkedFromId).toBeNull()
    expect(() => RecipeSchema.parse({ ...validRecipe, forkedFromId: 'not-a-uuid' })).toThrow()
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

  it('strips forkedFromId (server-managed, only the copy endpoint sets it)', () => {
    const result = CreateRecipeSchema.parse({
      ...validRecipe,
      forkedFromId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    })
    expect('forkedFromId' in result).toBe(false)
  })

  it('keeps visibility (clients may create public recipes directly)', () => {
    expect(CreateRecipeSchema.parse({ ...validRecipe, visibility: 'public' }).visibility).toBe(
      'public',
    )
  })
})

describe('UpdateRecipeSchema', () => {
  it('allows partial updates (all fields optional)', () => {
    const result = UpdateRecipeSchema.parse({ title: 'Updated Title' })
    expect(result.title).toBe('Updated Title')
  })

  it('accepts a visibility-only update and rejects invalid values', () => {
    expect(UpdateRecipeSchema.parse({ visibility: 'public' }).visibility).toBe('public')
    expect(() => UpdateRecipeSchema.parse({ visibility: 'shared' })).toThrow()
  })

  it('parses an empty object to an empty object (no defaults injected)', () => {
    expect(UpdateRecipeSchema.parse({})).toEqual({})
  })

  it('never injects defaults for omitted fields (a title-only update stays title-only)', () => {
    // Regression: Zod 4 kept .default([]) inside .partial(), so every partial
    // update wiped steps, tags, images and translations.
    expect(UpdateRecipeSchema.parse({ title: 'x' })).toEqual({ title: 'x' })
  })

  it('still validates the formerly-defaulted fields when they are provided', () => {
    const result = UpdateRecipeSchema.parse({ tags: ['a'], steps: [{ text: 'Paso' }] })
    expect(result.tags).toEqual(['a'])
    expect(result.steps).toHaveLength(1)
    expect(() => UpdateRecipeSchema.parse({ images: ['not a url'] })).toThrow()
  })
})

describe('recipe image URLs', () => {
  it('only accept http(s) on create and update', () => {
    const base = {
      title: 'X',
      servings: 1,
      category: 'Cena',
      ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
    }
    expect(CreateRecipeSchema.safeParse({ ...base, images: ['javascript:alert(1)'] }).success).toBe(
      false,
    )
    expect(UpdateRecipeSchema.safeParse({ images: ['data:image/svg+xml,<svg/>'] }).success).toBe(
      false,
    )
    expect(UpdateRecipeSchema.safeParse({ images: ['https://img.example/a.jpg'] }).success).toBe(
      true,
    )
  })
})

describe('recipe size limits', () => {
  const base = {
    title: 'X',
    servings: 1,
    category: 'Cena',
    ingredients: [{ name: 'a', quantity: 1, unit: 'g' }],
  }
  it('rejects oversized titles, tag lists and step lists on create and update', () => {
    expect(CreateRecipeSchema.safeParse({ ...base, title: 'x'.repeat(201) }).success).toBe(false)
    expect(
      CreateRecipeSchema.safeParse({ ...base, tags: Array.from({ length: 31 }, () => 't') })
        .success,
    ).toBe(false)
    expect(
      UpdateRecipeSchema.safeParse({ steps: Array.from({ length: 151 }, () => ({ text: 's' })) })
        .success,
    ).toBe(false)
    expect(CreateRecipeSchema.safeParse(base).success).toBe(true)
  })
})

describe('nutrition targets', () => {
  it('default macros add up to the default calories', () => {
    const d = DEFAULT_NUTRITION_TARGETS
    expect(
      Math.abs(
        atwaterKcal({
          protein_g: d.daily_protein_g,
          carbs_g: d.daily_carbs_g,
          fat_g: d.daily_fat_g,
        }) - d.daily_calories,
      ),
    ).toBeLessThanOrEqual(20)
  })
  it('rejects absurd targets', () => {
    expect(NutritionTargetsSchema.safeParse({ ...DEFAULT_NUTRITION_TARGETS }).success).toBe(true)
    expect(
      NutritionTargetsSchema.safeParse({ ...DEFAULT_NUTRITION_TARGETS, daily_calories: 20000 })
        .success,
    ).toBe(false)
  })
})
