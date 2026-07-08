import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createApiClient } from '../index.js'

export function registerConfiguratorTools(
  server: McpServer,
  api: ReturnType<typeof createApiClient>,
) {
  server.tool(
    'listTaxonomy',
    'List all categories, food types and tags with their usage counts',
    async () => {
      const overview = await api.request('/v1/config/taxonomy')
      return { content: [{ type: 'text' as const, text: JSON.stringify(overview, null, 2) }] }
    },
  )

  server.tool(
    'renameTaxonomyItem',
    'Rename a category, food type or tag',
    {
      type: z.enum(['categories', 'food-types', 'tags']),
      id: z.uuid(),
      newName: z.string().min(1),
    },
    async ({ type, id, newName }) => {
      const result = await api.request(`/v1/config/${type}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'mergeTags',
    'Merge a source tag into a target tag (all recipes are reassigned, source is deleted)',
    {
      sourceId: z.uuid().describe('Tag to merge FROM (will be deleted)'),
      targetId: z.uuid().describe('Tag to merge INTO (will be kept)'),
    },
    async ({ sourceId, targetId }) => {
      const result = await api.request('/v1/config/tags/merge', {
        method: 'POST',
        body: JSON.stringify({ sourceId, targetId }),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.tool(
    'getTaxonomyUsage',
    'Get which recipes use a specific taxonomy item',
    {
      type: z.enum(['categories', 'food-types', 'tags']),
      id: z.uuid(),
    },
    async ({ type, id }) => {
      const overview = (await api.request('/v1/config/taxonomy')) as {
        mealCategories: Array<{ id: string; name: string; usageCount: number }>
        foodTypes: Array<{ id: string; name: string; usageCount: number }>
        tags: Array<{ id: string; name: string; usageCount: number }>
      }
      const list =
        type === 'categories'
          ? overview.mealCategories
          : type === 'food-types'
            ? overview.foodTypes
            : overview.tags
      const item = list.find((i) => i.id === id)
      return {
        content: [
          {
            type: 'text' as const,
            text: item
              ? `"${item.name}" is used by ${item.usageCount} recipe(s).`
              : 'Item not found.',
          },
        ],
      }
    },
  )
}
