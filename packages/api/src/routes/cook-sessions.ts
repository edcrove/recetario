import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth.js'
import { cookSessionsRepository } from '../db/cook-sessions-repository.js'

export const cookSessionsRoute = new OpenAPIHono()

cookSessionsRoute.use('*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const sessionSchema = z.object({
  id: z.string().uuid(),
  recipeId: z.string().uuid(),
  ownerId: z.string(),
  cookedAt: z.string(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

const statsSchema = z.object({
  totalSessions: z.number().int(),
  topRecipes: z.array(
    z.object({
      recipeId: z.string().uuid(),
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
            recipeId: z.string().uuid(),
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
    params: z.object({ id: z.string().uuid() }),
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
      since: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
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
    totalSessions: stats.totalSessions,
    topRecipes: stats.topRecipes.map((r) => ({
      recipeId: r.recipeId,
      count: r.count,
      lastCookedAt: new Date(r.lastCookedAt).toISOString(),
    })),
    frequencyByWeek: stats.frequencyByWeek,
  })
})

// GET /v1/cook-sessions (all sessions for user, for error 400 missing recipeId awareness)
const listRoute = defineRoute({
  method: 'get',
  path: '/',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      recipeId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
      offset: z.coerce.number().int().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(sessionSchema) } },
      description: 'OK',
    },
    400: { content: { 'application/json': { schema: errorSchema } }, description: 'Bad request' },
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
cookSessionsRoute.openapi(listRoute as any, async (c: any) => {
  const ownerId = c.get('ownerId')
  const { recipeId, limit = 20, offset = 0 } = c.req.valid('query')

  if (!recipeId) return c.json({ error: 'recipeId query param required' }, 400)

  const sessions = await cookSessionsRepository.listByRecipe(ownerId, recipeId, limit, offset)
  return c.json(
    sessions.map((s) => ({
      id: s.id,
      recipeId: s.recipeId,
      ownerId: s.ownerId,
      cookedAt: s.cookedAt.toISOString(),
      rating: s.rating,
      notes: s.notes,
      createdAt: s.createdAt.toISOString(),
    })),
  )
})
