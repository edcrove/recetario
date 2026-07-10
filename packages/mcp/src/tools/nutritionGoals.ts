import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createApiClient } from '../index.js'

const mealTarget = z.object({
  calories: z.number().min(0).optional(),
  protein_g: z.number().min(0).optional(),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
})

export function registerNutritionGoalTools(
  server: McpServer,
  api: ReturnType<typeof createApiClient>,
) {
  // setNutritionGoals
  server.tool(
    'setNutritionGoals',
    "Set the user's daily macro targets (kcal, protein, carbs, fat) and optional per-meal calorie/macro goals keyed by meal slot (Desayuno/Almuerzo/Merienda/Cena). Used by the planner to show how far over or under each day lands.",
    {
      daily_calories: z.number().int().min(0).describe('Daily calorie target'),
      daily_protein_g: z.number().min(0).describe('Daily protein target (g)'),
      daily_carbs_g: z.number().min(0).describe('Daily carbohydrate target (g)'),
      daily_fat_g: z.number().min(0).describe('Daily fat target (g)'),
      per_meal: z
        .record(z.string(), mealTarget)
        .optional()
        .describe('Optional per-meal targets keyed by meal slot'),
    },
    async (args) => {
      const profile = await api.request('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ nutritionTargets: args }),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }] }
    },
  )

  // getDayNutrition
  server.tool(
    'getDayNutrition',
    "Roll up one day's planned menu into macro totals and, when a daily target is set, the signed delta vs it (positive = over the target, negative = under). Includes a per-meal breakdown and a partial flag when a planned recipe lacks nutrition data (those are excluded, never guessed). Use it to plan or adjust a day toward the user's goals.",
    {
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Day to roll up (YYYY-MM-DD)'),
    },
    async ({ date }) => {
      const result = await api.request(`/v1/menu/day-nutrition?date=${date}`)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    },
  )
}
