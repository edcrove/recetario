import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createApiClient } from '../index.js'

export function registerMacrosTools(server: McpServer, api: ReturnType<typeof createApiClient>) {
  server.tool(
    'getMacros',
    'Get nutrition macros for a recipe scaled to a given number of servings',
    {
      recipeId: z.uuid().describe('Recipe UUID'),
      servings: z
        .number()
        .int()
        .min(1)
        .default(1)
        .optional()
        .describe('Number of servings (default: 1)'),
    },
    async ({ recipeId, servings = 1 }) => {
      const recipe = (await api.request(`/v1/recipes/${recipeId}`)) as {
        title: string
        servings: number
        nutrition?: {
          calories: number
          protein_g: number
          carbs_g: number
          fat_g: number
          fiber_g?: number
        } | null
      }
      if (!recipe.nutrition) {
        return {
          content: [
            { type: 'text' as const, text: `Recipe "${recipe.title}" has no nutrition data.` },
          ],
        }
      }
      const scale = recipe.servings > 0 ? servings / recipe.servings : 1
      const scaled = {
        calories: Math.round(recipe.nutrition.calories * scale),
        protein_g: Math.round(recipe.nutrition.protein_g * scale * 10) / 10,
        carbs_g: Math.round(recipe.nutrition.carbs_g * scale * 10) / 10,
        fat_g: Math.round(recipe.nutrition.fat_g * scale * 10) / 10,
        fiber_g:
          recipe.nutrition.fiber_g != null
            ? Math.round(recipe.nutrition.fiber_g * scale * 10) / 10
            : undefined,
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ recipe: recipe.title, servings, ...scaled }, null, 2),
          },
        ],
      }
    },
  )
}

export function registerCookHistoryTools(
  server: McpServer,
  api: ReturnType<typeof createApiClient>,
) {
  server.tool(
    'logCookSession',
    'Log that a recipe was cooked, with an optional rating (1-5) and notes',
    {
      recipeId: z.uuid().describe('Recipe UUID'),
      rating: z.number().int().min(1).max(5).optional().describe('Rating 1-5'),
      notes: z.string().max(1000).optional().describe('Cooking notes'),
    },
    async (args) => {
      const session = await api.request('/v1/cook-sessions', {
        method: 'POST',
        body: JSON.stringify(args),
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(session, null, 2) }],
      }
    },
  )

  server.tool(
    'getCookHistory',
    'Get the cooking history for a recipe or all recent sessions',
    {
      recipeId: z.uuid().optional().describe('Filter by recipe (optional)'),
      limit: z.number().int().min(1).max(100).default(10).optional().describe('Max results'),
    },
    async (args) => {
      const qs = new URLSearchParams()
      if (args.recipeId) qs.set('recipeId', args.recipeId)
      if (args.limit) qs.set('limit', String(args.limit))
      const sessions = await api.request(`/v1/cook-sessions?${qs}`)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(sessions, null, 2) }],
      }
    },
  )

  server.tool(
    'getMostCooked',
    'Get cooking statistics: top recipes by count, frequency by week, total sessions',
    {
      since: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Start date YYYY-MM-DD (default: last 90 days)'),
    },
    async (args) => {
      const qs = args.since ? `?since=${args.since}` : ''
      const stats = await api.request(`/v1/cook-sessions/stats${qs}`)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }],
      }
    },
  )
}
