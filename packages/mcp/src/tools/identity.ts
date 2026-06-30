import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createApiClient } from '../index.js'

export function registerIdentityTools(server: McpServer, api: ReturnType<typeof createApiClient>) {
  server.tool('whoami', 'Get the current authenticated user profile', async () => {
    const [me, profile] = await Promise.all([
      api.request('/auth/me') as Promise<{ id: string; email: string; displayName: string | null }>,
      api.request('/auth/profile').catch(() => null) as Promise<{
        preferredServings: number | null
        dietaryRestrictions: string[]
        allergens: string[]
      } | null>,
    ])
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ ...me, profile }, null, 2),
        },
      ],
    }
  })

  server.tool(
    'updateProfile',
    'Update user profile preferences (servings, dietary restrictions, allergens)',
    {
      preferredServings: z.number().int().min(1).max(20).optional().describe('Default servings'),
      dietaryRestrictions: z
        .array(z.enum(['vegano', 'vegetariano', 'sin-gluten', 'sin-lactosa', 'keto', 'paleo']))
        .optional()
        .describe('Dietary restrictions'),
      allergens: z.array(z.string()).optional().describe('Allergen list'),
      goals: z.array(z.string()).optional().describe('Nutrition or meal goals'),
    },
    async (args) => {
      const profile = await api.request('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(args),
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }],
      }
    },
  )

  server.tool(
    'listHouseholdMembers',
    'List members of all households the current user belongs to',
    async () => {
      const households = (await api.request('/v1/households/mine')) as Array<{
        id: string
        name: string
        members?: Array<{ userId: string; role: string }>
      }>
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(households, null, 2) }],
      }
    },
  )
}
