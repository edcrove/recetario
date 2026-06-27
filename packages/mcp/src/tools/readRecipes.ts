import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createApiClient } from '../index.js'

export function registerReadTools(server: McpServer, api: ReturnType<typeof createApiClient>) {
  // getRecipe
  server.tool(
    'getRecipe',
    'Get a single recipe by its ID.',
    { id: z.string().uuid().describe('Recipe UUID') },
    async ({ id }) => {
      const recipe = await api.request(`/v1/recipes/${id}`)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(recipe, null, 2) }],
      }
    },
  )

  // searchRecipes
  server.tool(
    'searchRecipes',
    'Search recipes by name, ingredient, tag, or category.',
    {
      q: z.string().optional().describe('Text search across title and ingredients'),
      tag: z.string().optional().describe('Filter by tag'),
      category: z.string().optional().describe('Filter by category'),
      ingredient: z.string().optional().describe('Filter by ingredient name'),
    },
    async (params) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null) as [string, string][],
      ).toString()
      const results = await api.request(`/v1/recipes/search${qs ? `?${qs}` : ''}`)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
      }
    },
  )

  // listRecipes
  server.tool(
    'listRecipes',
    'List all recipes with optional pagination.',
    {
      limit: z.number().int().positive().max(100).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
    },
    async ({ limit, offset }) => {
      const results = await api.request(`/v1/recipes?limit=${limit}&offset=${offset}`)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
      }
    },
  )
}
