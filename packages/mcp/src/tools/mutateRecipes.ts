import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createApiClient } from '../index.js'

export function registerMutationTools(server: McpServer, api: ReturnType<typeof createApiClient>) {
  server.tool(
    'updateRecipe',
    'Partially update an existing recipe. Only provided fields are changed.',
    {
      id: z.string().uuid().describe('Recipe UUID to update'),
      title: z.string().optional(),
      servings: z.number().int().positive().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      // Allow partial ingredient/step updates
      ingredients: z
        .array(
          z.object({
            name: z.string(),
            quantity: z.number().nullable(),
            unit: z.string().nullable(),
          }),
        )
        .optional(),
      steps: z.array(z.object({ text: z.string() })).optional(),
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
    { id: z.string().uuid().describe('Recipe UUID to delete') },
    async ({ id }) => {
      await api.request(`/v1/recipes/${id}`, { method: 'DELETE' })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id }) }],
      }
    },
  )
}
