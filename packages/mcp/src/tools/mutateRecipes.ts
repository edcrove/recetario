import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createApiClient } from '../index.js'
import {
  CategoryInput,
  DietaryTagsInput,
  DifficultyInput,
  FoodTypeIdsInput,
  IngredientInput,
  NutritionInput,
  StepInput,
  VisibilityInput,
} from './recipeInputs.js'

export function registerMutationTools(server: McpServer, api: ReturnType<typeof createApiClient>) {
  server.tool(
    'updateRecipe',
    'Partially update an existing recipe. Only provided fields are changed.',
    {
      id: z.uuid().describe('Recipe UUID to update'),
      title: z.string().min(1).max(200).optional(),
      servings: z.number().int().positive().optional(),
      category: CategoryInput.optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      prepTimeMin: z.number().int().positive().nullable().optional().describe('null clears it'),
      cookTimeMin: z.number().int().positive().nullable().optional().describe('null clears it'),
      totalTimeMin: z.number().int().positive().nullable().optional().describe('null clears it'),
      difficulty: DifficultyInput,
      ingredients: z
        .array(IngredientInput)
        .min(1)
        .optional()
        .describe('Replaces the whole ingredient list (send every ingredient, not a diff)'),
      steps: z
        .array(StepInput)
        .optional()
        .describe('Replaces the whole step list (send every step, not a diff)'),
      visibility: VisibilityInput.optional().describe(
        "Owner-only publish/unpublish: 'public' lists the recipe in the shared library; 'private' hides it again (existing forks are unaffected).",
      ),
      dietaryTags: DietaryTagsInput.optional(),
      nutrition: NutritionInput.nullable()
        .optional()
        .describe(
          'Per-serving nutrition. null clears it. If omitted, a servings-only edit rescales it and an ingredient change clears it (re-estimate and send it again).',
        ),
      foodTypeIds: FoodTypeIdsInput.optional(),
    },
    async ({ id, ...updates }) => {
      const recipe = await api.request(`/v1/recipes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(recipe, null, 2) }],
      }
    },
  )

  server.tool(
    'deleteRecipe',
    'Delete a recipe by ID. This action is irreversible.',
    { id: z.uuid().describe('Recipe UUID to delete') },
    async ({ id }) => {
      await api.request(`/v1/recipes/${id}`, { method: 'DELETE' })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id }) }],
      }
    },
  )
}
