import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createApiClient } from '../index.js'

export function registerCookHistoryTools(
  server: McpServer,
  api: ReturnType<typeof createApiClient>,
) {
  server.tool(
    'logCookSession',
    'Log that a recipe was cooked, with an optional rating (1-5) and notes',
    {
      recipeId: z.string().uuid().describe('Recipe UUID'),
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
      recipeId: z.string().uuid().optional().describe('Filter by recipe (optional)'),
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
