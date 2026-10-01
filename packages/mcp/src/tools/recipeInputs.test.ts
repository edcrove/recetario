import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { UnitSchema, CategorySchema } from '@recetario/shared'
import { createMcpServer, createApiClient } from '../index.js'
import { registerMutationTools } from './mutateRecipes.js'
import { registerCreateRecipe } from './createRecipe.js'
import { CATEGORY_LIST, UNIT_LIST } from './recipeInputs.js'

function inputSchema(name: string): z.ZodType {
  const server = createMcpServer()
  const api = createApiClient()
  registerMutationTools(server, api)
  registerCreateRecipe(server, api)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools[name] as { inputSchema: z.ZodType }
  return tool.inputSchema
}

const ID = 'e7a5b3c1-1234-5678-9abc-def012345678'
const fullIngredient = {
  name: 'Cebolla',
  quantity: 1,
  unit: 'unit',
  presentation: 'picada',
  group: 'Para el sofrito',
  note: 'morada',
}
const fullStep = { text: 'Hornear', durationSeconds: 2400, ovenTempC: 180 }

describe('recipe input contract (shared schemas)', () => {
  it('lists come from the shared enums', () => {
    expect(UNIT_LIST).toBe(UnitSchema.options.join(', '))
    expect(CATEGORY_LIST).toBe(CategorySchema.options.join(', '))
  })

  it('updateRecipe rejects a free-string unit', () => {
    const r = inputSchema('updateRecipe').safeParse({
      id: ID,
      ingredients: [{ ...fullIngredient, unit: 'puñado' }],
    })
    expect(r.success).toBe(false)
  })

  it('updateRecipe keeps presentation/group/note and step timer/oven fields', () => {
    const r = inputSchema('updateRecipe').parse({
      id: ID,
      ingredients: [fullIngredient],
      steps: [fullStep],
      category: 'Cena',
      prepTimeMin: null,
      difficulty: 'media',
    })
    expect(r).toMatchObject({
      ingredients: [fullIngredient],
      steps: [fullStep],
      category: 'Cena',
      prepTimeMin: null,
      difficulty: 'media',
    })
  })

  it('updateRecipe rejects an unknown category and an empty ingredient list', () => {
    const schema = inputSchema('updateRecipe')
    expect(schema.safeParse({ id: ID, category: 'Merienda' }).success).toBe(false)
    expect(schema.safeParse({ id: ID, ingredients: [] }).success).toBe(false)
  })

  it('createRecipe enforces the shared limits (positive quantity, step text)', () => {
    const schema = inputSchema('createRecipe')
    const base = { title: 'X', servings: 2, category: 'Cena', ingredients: [fullIngredient] }
    expect(schema.safeParse(base).success).toBe(true)
    expect(
      schema.safeParse({ ...base, ingredients: [{ ...fullIngredient, quantity: -1 }] }).success,
    ).toBe(false)
    expect(schema.safeParse({ ...base, steps: [{ text: '' }] }).success).toBe(false)
  })

  it('updateRecipe accepts nutrition: null to clear stale values', () => {
    expect(inputSchema('updateRecipe').safeParse({ id: ID, nutrition: null }).success).toBe(true)
  })
})
