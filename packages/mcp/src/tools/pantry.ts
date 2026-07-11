import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createApiClient } from '../index.js'

export function registerPantryTools(server: McpServer, api: ReturnType<typeof createApiClient>) {
  server.tool(
    'update_pantry',
    "Add or update items in the household's pantry (upsert by name). Use for 'compramos 2 kg de harina' or 'se nos acabó la leche' (inStock: false). Quantity, unit and expiry are optional.",
    {
      items: z
        .array(
          z.object({
            name: z.string().min(1),
            quantity: z.string().nullable().optional(),
            unit: z.string().nullable().optional(),
            expiryDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .nullable()
              .optional()
              .describe('ISO date YYYY-MM-DD'),
            inStock: z.boolean().optional(),
          }),
        )
        .min(1)
        .describe('Pantry items to upsert'),
    },
    async ({ items }) => {
      const result = await api.request('/v1/pantry/bulk', {
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'what_can_i_cook',
    "Rank the household's recipes by how many of their ingredients are already in the pantry (in-stock). Returns matchedCount/totalCount and the missing ingredients per recipe, most cookable first. Ingredient matching is canonical (pechuga = pollo) and deterministic.",
    async () => {
      const ranked = await api.request('/v1/pantry/cookable')
      return { content: [{ type: 'text' as const, text: JSON.stringify(ranked, null, 2) }] }
    },
  )
}
