import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createApiClient } from '../index.js'

export function registerLibraryTools(server: McpServer, api: ReturnType<typeof createApiClient>) {
  // browseLibrary
  server.tool(
    'browseLibrary',
    "Browse the public recipe library: recipes any user chose to publish, with the author display name. Use copyRecipe to bring one into this user's own collection.",
    {
      search: z.string().optional().describe('Filter by title'),
      limit: z.number().int().positive().max(100).optional().default(30),
      offset: z.number().int().min(0).optional().default(0),
    },
    async ({ search, limit, offset }) => {
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
      if (search) qs.set('search', search)
      const results = await api.request(`/v1/library?${qs.toString()}`)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
      }
    },
  )

  // copyRecipe
  server.tool(
    'copyRecipe',
    "Copy a readable recipe (public, own, or a housemate's) into this user's collection as an independent fork: a full private snapshot with forkedFromId provenance. Edits to the copy never touch the original, and the original's future edits never propagate to the copy.",
    { id: z.uuid().describe('Recipe UUID to copy') },
    async ({ id }) => {
      const fork = await api.request(`/v1/recipes/${id}/copy`, { method: 'POST' })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(fork, null, 2) }],
      }
    },
  )
}
