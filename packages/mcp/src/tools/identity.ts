import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createApiClient } from '../index.js'
import { AllergenSchema } from '@recetario/shared'

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
      allergens: z
        .array(AllergenSchema)
        .optional()
        .describe(
          'Allergens to warn about, as keys of the 14 major allergens. Map the user\'s words: "lácteos" → leche, "nueces" → frutos_secos, "mariscos" → crustaceos/moluscos, "TACC" → gluten.',
        ),
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
    "List the households the current user belongs to, with each member's name, email, role and whether they accepted. A membership with acceptedAt null is a pending invitation (use respondToHouseholdInvitation).",
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

  server.tool(
    'respondToHouseholdInvitation',
    "Accept or decline a pending household invitation for the current user. Sharing (recipes, weekly menu, shopping list) starts only after accepting. Get the householdId from listHouseholdMembers (the user's membership has acceptedAt null).",
    {
      householdId: z.string().uuid().describe('Household with the pending invitation'),
      accept: z.boolean().describe('true = accept, false = decline'),
    },
    async ({ householdId, accept }) => {
      const result = await api.request(
        `/v1/households/${householdId}/${accept ? 'accept' : 'decline'}`,
        { method: 'POST' },
      )
      return {
        content: [
          {
            type: 'text' as const,
            text: accept ? JSON.stringify(result, null, 2) : 'Invitation declined.',
          },
        ],
      }
    },
  )

  server.tool(
    'changeHouseholdMemberRole',
    "Change a household member's role (admin, member or viewer). Only the household owner or an admin can do it, and the owner's own role never changes. Viewers are read-only on the shared menu, shopping list and pantry. Get householdId and userId from listHouseholdMembers.",
    {
      householdId: z.string().uuid().describe('Household the member belongs to'),
      userId: z.string().uuid().describe('Member whose role changes'),
      role: z.enum(['admin', 'member', 'viewer']).describe('New role'),
    },
    async ({ householdId, userId, role }) => {
      const member = await api.request(`/v1/households/${householdId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(member, null, 2) }],
      }
    },
  )

  server.tool(
    'leaveHousehold',
    'The current user leaves a household they joined; sharing (recipes, weekly menu, shopping list) stops right away. The owner cannot leave. For a pending invitation use respondToHouseholdInvitation with accept=false instead.',
    {
      householdId: z.string().uuid().describe('Household to leave'),
    },
    async ({ householdId }) => {
      await api.request(`/v1/households/${householdId}/leave`, { method: 'POST' })
      return { content: [{ type: 'text' as const, text: 'Left the household.' }] }
    },
  )
}
