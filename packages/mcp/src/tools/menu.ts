import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createApiClient } from '../index.js'

const MenuSlot = z.enum(['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros'])

export function registerMenuTools(server: McpServer, api: ReturnType<typeof createApiClient>) {
  // addToMenu
  server.tool(
    'addToMenu',
    'Add or replace a recipe in a meal slot for a specific date. Servings defaults to the recipe default.',
    {
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Date in YYYY-MM-DD format'),
      slot: MenuSlot.describe('Meal slot: Desayuno, Almuerzo, Merienda, Cena, or Snacks/Otros'),
      recipeId: z.uuid().describe('Recipe UUID to assign to this slot'),
      servings: z.number().int().positive().optional().default(1).describe('Number of servings'),
    },
    async ({ date, slot, recipeId, servings }) => {
      const entry = await api.request('/v1/menu', {
        method: 'POST',
        body: JSON.stringify({ date, slot, recipeId, servings }),
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(entry, null, 2) }],
      }
    },
  )

  // removeFromMenu
  server.tool(
    'removeFromMenu',
    'Remove a recipe from a meal slot on a specific date.',
    {
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Date in YYYY-MM-DD format'),
      slot: MenuSlot.describe('Meal slot to clear'),
    },
    async ({ date, slot }) => {
      await api.request(`/v1/menu/${date}/${encodeURIComponent(slot)}`, { method: 'DELETE' })
      return {
        content: [{ type: 'text' as const, text: `Removed ${slot} on ${date}` }],
      }
    },
  )

  // getMenu
  server.tool(
    'getMenu',
    'Get all planned meals for a week. Returns entries grouped by date and slot.',
    {
      weekStart: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Monday of the week in YYYY-MM-DD format'),
    },
    async ({ weekStart }) => {
      const entries = await api.request(`/v1/menu?weekStart=${weekStart}`)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }],
      }
    },
  )

  // generateShoppingList
  server.tool(
    'generateShoppingList',
    'Generate an aggregated shopping list from the planned meals for a week. ' +
      'Ingredients are scaled by servings and combined across recipes.',
    {
      weekStart: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Monday of the week in YYYY-MM-DD format'),
    },
    async ({ weekStart }) => {
      const list = await api.request(`/v1/menu/shopping-list?weekStart=${weekStart}`)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(list, null, 2) }],
      }
    },
  )
}
