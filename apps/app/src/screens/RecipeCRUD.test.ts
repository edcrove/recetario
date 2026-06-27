import { describe, it, expect } from 'vitest'
import { CreateRecipeSchema } from '@recetario/shared'

describe('CreateRecipeSchema validation (backs CRUD form)', () => {
  it('fails when title is missing', () => {
    const result = CreateRecipeSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('fails when ingredients are missing', () => {
    const result = CreateRecipeSchema.safeParse({
      title: 'Arroz con leche',
      servings: 4,
      category: 'Postre',
    })
    expect(result.success).toBe(false)
  })

  it('fails when servings is not a positive integer', () => {
    const result = CreateRecipeSchema.safeParse({
      title: 'Test',
      servings: 0,
      category: 'Cena',
      ingredients: [{ name: 'sal', quantity: null, unit: null }],
    })
    expect(result.success).toBe(false)
  })

  it('succeeds with minimal valid recipe', () => {
    const result = CreateRecipeSchema.safeParse({
      title: 'x',
      servings: 1,
      category: 'Cena',
      ingredients: [{ name: 'sal', quantity: null, unit: null }],
    })
    expect(result.success).toBe(true)
  })

  it('succeeds with full recipe data', () => {
    const result = CreateRecipeSchema.safeParse({
      title: 'Pasta Boloñesa',
      servings: 4,
      category: 'Cena',
      tags: ['italiana', 'pasta'],
      notes: 'Se puede congelar',
      ingredients: [
        { name: 'pasta', quantity: 200, unit: 'g' },
        { name: 'carne molida', quantity: 300, unit: 'g' },
        { name: 'sal', quantity: null, unit: null },
      ],
      steps: [{ text: 'Hervir agua con sal' }, { text: 'Cocinar la carne' }],
    })
    expect(result.success).toBe(true)
  })

  it('fails when ingredient name is empty', () => {
    const result = CreateRecipeSchema.safeParse({
      title: 'Test',
      servings: 2,
      category: 'Almuerzo',
      ingredients: [{ name: '', quantity: 100, unit: 'g' }],
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid category', () => {
    const result = CreateRecipeSchema.safeParse({
      title: 'Test',
      servings: 2,
      category: 'InvalidCategory',
      ingredients: [{ name: 'agua', quantity: 1, unit: 'l' }],
    })
    expect(result.success).toBe(false)
  })
})
