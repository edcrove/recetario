import { createRouter } from './router.js'
import { createRoute as defineRoute, z } from '@hono/zod-openapi'
import { CookSessionSchema, CookStatsSchema, cookingStreak } from '@recetario/shared'
import { authMiddleware } from '../middleware/auth.js'
import { cookSessionsRepository } from '../db/cook-sessions-repository.js'

export const cookSessionsRoute = createRouter()

cookSessionsRoute.use('*', authMiddleware)

const sessionSchema = CookSessionSchema

const statsSchema = CookStatsSchema

// POST /v1/cook-sessions
const createRoute = defineRoute({
  method: 'post',
  path: '/',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            recipeId: z.uuid(),
            rating: z.number().int().min(1).max(5).nullable().optional(),
            notes: z.string().max(1000).optional(),
            servings: z.number().int().positive().max(100).optional(),
            source: z.enum(['app', 'mcp']).optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: sessionSchema } }, description: 'Created' },
  },
})

cookSessionsRoute.openapi(createRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { recipeId, ...input } = c.req.valid('json')

  const session = await cookSessionsRepository.create(ownerId, recipeId, input)

  return c.json(
    {
      id: session.id,
      recipeId: session.recipeId,
      recipeTitle: session.recipeTitle,
      ownerId: session.ownerId,
      cookedAt: session.cookedAt.toISOString(),
      rating: session.rating,
      notes: session.notes,
      servings: session.servings,
      source: session.source,
      createdAt: session.createdAt.toISOString(),
    },
    201,
  )
})

// GET /v1/recipes/:id/cook-sessions
const listByRecipeRoute = defineRoute({
  method: 'get',
  path: '/recipes/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
      offset: z.coerce.number().int().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(sessionSchema) } },
      description: 'OK',
    },
  },
})

cookSessionsRoute.openapi(listByRecipeRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const { limit = 20, offset = 0 } = c.req.valid('query')

  const sessions = await cookSessionsRepository.listByRecipe(ownerId, id, limit, offset)

  return c.json(
    sessions.map((s) => ({
      id: s.id,
      recipeId: s.recipeId,
      recipeTitle: s.recipeTitle,
      ownerId: s.ownerId,
      cookedAt: s.cookedAt.toISOString(),
      rating: s.rating,
      notes: s.notes,
      servings: s.servings,
      source: s.source,
      createdAt: s.createdAt.toISOString(),
    })),
  )
})

// GET /v1/cook-sessions/stats
const statsRoute = defineRoute({
  method: 'get',
  path: '/stats',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      since: z.iso.date().optional(),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: statsSchema } }, description: 'OK' },
  },
})

cookSessionsRoute.openapi(statsRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { since } = c.req.valid('query')

  const sinceDate = since ? new Date(since) : undefined
  const stats = await cookSessionsRepository.getStats(ownerId, sinceDate)
  const { days, today } = await cookSessionsRepository.cookDays(ownerId)

  return c.json({
    since: stats.windowStart.toISOString().slice(0, 10),
    totalSessions: stats.totalSessions,
    topRecipes: stats.topRecipes.map((r) => ({
      recipeId: r.recipeId,
      title: r.title,
      count: r.count,
      lastCookedAt: new Date(r.lastCookedAt).toISOString(),
    })),
    frequencyByWeek: stats.frequencyByWeek,
    streak: cookingStreak(days, today),
  })
})

// GET /v1/cook-sessions — the user's sessions, newest first; optionally for one recipe
const listRoute = defineRoute({
  method: 'get',
  path: '/',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      recipeId: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
      offset: z.coerce.number().int().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(sessionSchema) } },
      description: 'OK',
    },
  },
})

cookSessionsRoute.openapi(listRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { recipeId, limit = 20, offset = 0 } = c.req.valid('query')

  const sessions = recipeId
    ? await cookSessionsRepository.listByRecipe(ownerId, recipeId, limit, offset)
    : await cookSessionsRepository.listRecent(ownerId, limit, offset)
  return c.json(
    sessions.map((s) => ({
      id: s.id,
      recipeId: s.recipeId,
      recipeTitle: s.recipeTitle,
      ownerId: s.ownerId,
      cookedAt: s.cookedAt.toISOString(),
      rating: s.rating,
      notes: s.notes,
      servings: s.servings,
      source: s.source,
      createdAt: s.createdAt.toISOString(),
    })),
  )
})
