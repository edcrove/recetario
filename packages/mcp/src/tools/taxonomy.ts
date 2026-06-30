import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createApiClient } from '../index.js'

export function registerTaxonomyTools(server: McpServer, api: ReturnType<typeof createApiClient>) {
  server.tool(
    'getFoodTypes',
    'Get all food type categories (guiso, sopa, carne, etc.)',
    async () => {
      const types = await api.request('/v1/food-types')
      return { content: [{ type: 'text' as const, text: JSON.stringify(types, null, 2) }] }
    },
  )

  server.tool(
    'createCollection',
    'Create a named collection to group recipes',
    {
      name: z.string().min(1).describe('Collection name'),
      emoji: z.string().optional().describe('Emoji icon'),
      description: z.string().optional(),
    },
    async (args) => {
      const col = await api.request('/v1/collections', {
        method: 'POST',
        body: JSON.stringify(args),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(col, null, 2) }] }
    },
  )

  server.tool('listCollections', 'List all recipe collections for the current user', async () => {
    const cols = await api.request('/v1/collections')
    return { content: [{ type: 'text' as const, text: JSON.stringify(cols, null, 2) }] }
  })

  server.tool(
    'addToCollection',
    'Add a recipe to a collection',
    { collectionId: z.string().uuid(), recipeId: z.string().uuid() },
    async ({ collectionId, recipeId }) => {
      const result = await api.request(`/v1/collections/${collectionId}/recipes`, {
        method: 'POST',
        body: JSON.stringify({ recipeId }),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'addRecipeRelation',
    'Create a relation between two recipes (similar, variation, or inspiration)',
    {
      fromId: z.string().uuid().describe('Source recipe UUID'),
      toId: z.string().uuid().describe('Target recipe UUID'),
      relationType: z.enum(['similar', 'variation', 'inspiration']),
    },
    async (args) => {
      const result = await api.request(`/v1/recipes/${args.fromId}/relations`, {
        method: 'POST',
        body: JSON.stringify({
          toId: args.toId,
          relationType: args.relationType,
          createdBy: 'agent',
        }),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'getRelatedRecipes',
    'Get recipes related to a given recipe (similar, variations, inspirations)',
    { recipeId: z.string().uuid() },
    async ({ recipeId }) => {
      const relations = await api.request(`/v1/recipes/${recipeId}/relations`)
      return { content: [{ type: 'text' as const, text: JSON.stringify(relations, null, 2) }] }
    },
  )
}
