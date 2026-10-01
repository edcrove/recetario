import { createRouter } from './router.js'
import { createRoute as defineRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth.js'
import { cookSessionsRepository } from '../db/cook-sessions-repository.js'

export const cookSessionsRoute = createRouter()

cookSessionsRoute.use('*', authMiddleware)

const sessionSchema = z.object({
  id: z.uuid(),
  recipeId: z.uuid().nullable(),
  recipeTitle: z.string().nullable().optional(),
  ownerId: z.string(),
  cookedAt: z.string(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

const statsSchema = z.object({
  // Every figure covers the same window: `since` (default: last 90 days)
  since: z.string(),
  totalSessions: z.number().int(),
  topRecipes: z.array(
    z.object({
      recipeId: z.uuid().nullable(),
      title: z.string().nullable(),
      count: z.number().int(),
      lastCookedAt: z.string(),
    }),
  ),
  frequencyByWeek: z.array(
    z.object({
      week: z.string(),
      count: z.number().int(),
    }),
  ),
})

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
  const { recipeId, rating, notes } = c.req.valid('json')

  const session = await cookSessionsRepository.create(ownerId, recipeId, rating, notes)

  return c.json(
    {
      id: session.id,
      recipeId: session.recipeId,
      recipeTitle: session.recipeTitle,
      ownerId: session.ownerId,
      cookedAt: session.cookedAt.toISOString(),
      rating: session.rating,
      notes: session.notes,
      createdAt: session.createdAt.toISOString(),
    },
    201,
  )
})

// GET /v1/recipes/:id/cook-sessions
const listByRecipeRoute = defineRoute({
  method: 'get',
  path: '/recipes/:id',
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
cookSessionsRoute.openapi(listRoute as any, async (c: any) => {
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
      createdAt: s.createdAt.toISOString(),
    })),
  )
})
