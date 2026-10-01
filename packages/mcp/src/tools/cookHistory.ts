import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { scalePerServing, type Nutrition } from '@recetario/shared'
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
        nutrition?: Nutrition | null
      }
      if (!recipe.nutrition) {
        return {
          content: [
            { type: 'text' as const, text: `Recipe "${recipe.title}" has no nutrition data.` },
          ],
        }
      }
      // Nutrition is stored per serving (ADR-010): N servings = N × the stored values
      const scaled = scalePerServing(recipe.nutrition, servings)
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
      servings: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe('How many servings were cooked (defaults to unknown)'),
    },
    async (args) => {
      const session = await api.request('/v1/cook-sessions', {
        method: 'POST',
        // Sessions logged by an agent are tagged so analytics can tell them apart
        body: JSON.stringify({ ...args, source: 'mcp' }),
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
