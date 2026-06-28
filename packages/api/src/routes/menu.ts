import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { MenuEntrySchema, MenuSlotSchema, CreateMenuEntrySchema } from '@recetario/shared'
import { menuRepository } from '../db/menu-repository.js'
import { authMiddleware } from '../middleware/auth.js'
import '../types.js'

export const menuRoute = new OpenAPIHono()

menuRoute.use('/menu', authMiddleware)
menuRoute.use('/menu/*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

// POST /v1/menu — upsert entry
const postMenuRoute = defineRoute({
  method: 'post',
  path: '/menu',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateMenuEntrySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MenuEntrySchema } },
      description: 'Menu entry upserted',
    },
    422: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Validation error',
    },
  },
})

menuRoute.openapi(postMenuRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const body = c.req.valid('json')
  const entry = await menuRepository.upsert(ownerId, body)
  return c.json(entry, 200)
})

// DELETE /v1/menu/:date/:slot — remove entry
const deleteMenuRoute = defineRoute({
  method: 'delete',
  path: '/menu/{date}/{slot}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: MenuSlotSchema,
    }),
  },
  responses: {
    204: { description: 'Entry removed' },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Entry not found',
    },
  },
})

menuRoute.openapi(deleteMenuRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { date, slot } = c.req.valid('param')
  const deleted = await menuRepository.remove(ownerId, date, slot)
  if (!deleted) return c.json({ error: 'Menu entry not found' }, 404)
  return new Response(null, { status: 204 })
})

// GET /v1/menu — get week entries
const getMenuRoute = defineRoute({
  method: 'get',
  path: '/menu',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(MenuEntrySchema) } },
      description: 'Menu entries for the week',
    },
  },
})

menuRoute.openapi(getMenuRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { weekStart } = c.req.valid('query')
  const entries = await menuRepository.getWeek(ownerId, weekStart)
  return c.json(entries, 200)
})
