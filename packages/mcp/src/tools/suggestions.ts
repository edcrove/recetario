import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createApiClient } from '../index.js'

export function registerSuggestionTools(
  server: McpServer,
  api: ReturnType<typeof createApiClient>,
) {
  server.tool(
    'suggest_from_ingredients',
    "Answer '¿qué cocino con lo que tengo?'. Ranks the household's recipes by ingredient coverage (fraction of ingredients on hand), then breaks ties by how close each fits the day's remaining nutrition goal. Provide `ingredients` (an ad-hoc list like ['pollo','arroz']) and/or set `usePantry: true` to also use the in-stock pantry. Pass `date` (YYYY-MM-DD) to enable goalFit. Each recipe returns matchedCount/totalCount, missingIngredients[], and goalFit ('dentro' = fits the remaining goal, 'cerca', 'lejos', or null when no goal/nutrition).",
    {
      ingredients: z
        .array(z.string().min(1))
        .optional()
        .describe("Ad-hoc list of what's on hand, e.g. ['pollo','arroz']"),
      usePantry: z.boolean().optional().describe('Also include the in-stock pantry'),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe('Day for goal context (YYYY-MM-DD)'),
    },
    async ({ ingredients, usePantry, date }) => {
      const body: Record<string, unknown> = {}
      if (ingredients) body['ingredients'] = ingredients
      if (usePantry) body['usePantry'] = usePantry
      if (date) body['date'] = date
      const ranked = await api.request('/v1/suggestions/from-ingredients', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(ranked, null, 2) }] }
    },
  )

  server.tool(
    'get_menu_missing_ingredients',
    "Answer '¿qué compro para terminar la semana?'. For the planned week, returns `missing` (the combined shopping items still needed after subtracting the in-stock pantry, canonical-aggregated) and `meals` (each planned meal flagged cookable now or not, with its missing ingredients).",
    {
      weekStart: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Monday of the week (YYYY-MM-DD)'),
    },
    async ({ weekStart }) => {
      const gap = await api.request(`/v1/menu/missing-ingredients?weekStart=${weekStart}`)
      return { content: [{ type: 'text' as const, text: JSON.stringify(gap, null, 2) }] }
    },
  )
}
