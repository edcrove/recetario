import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { pantryRepository } from '../db/pantry-repository.js'
import { authMiddleware } from '../middleware/auth.js'
import '../types.js'

export const pantryRoute = new OpenAPIHono()
pantryRoute.use('/pantry', authMiddleware)
pantryRoute.use('/pantry/*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const pantryItemSchema = z.object({
  id: z.uuid(),
  ownerId: z.string(),
  name: z.string(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  expiryDate: z.string().nullable(),
  inStock: z.boolean(),
})

const createBody = z.object({
  name: z.string().min(1),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  inStock: z.boolean().optional(),
})

// GET /v1/pantry
const listRoute = defineRoute({
  method: 'get',
  path: '/pantry',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(pantryItemSchema) } },
      description: "The household's pantry",
    },
  },
})

pantryRoute.openapi(listRoute, async (c) => {
  const ownerId = c.get('ownerId')
  return c.json(await pantryRepository.list(ownerId), 200)
})

// POST /v1/pantry
const createRoute = defineRoute({
  method: 'post',
  path: '/pantry',
  security: [{ ApiKeyAuth: [] }],
  request: { body: { content: { 'application/json': { schema: createBody } }, required: true } },
  responses: {
    201: {
      content: { 'application/json': { schema: pantryItemSchema } },
      description: 'Item added',
    },
  },
})

pantryRoute.openapi(createRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const item = await pantryRepository.create(ownerId, c.req.valid('json'))
  return c.json(item, 201)
})

// PATCH /v1/pantry/{id}
const updateRoute = defineRoute({
  method: 'patch',
  path: '/pantry/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: { content: { 'application/json': { schema: createBody.partial() } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: pantryItemSchema } },
      description: 'Item updated',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not found or not visible',
    },
  },
})

pantryRoute.openapi(updateRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const updated = await pantryRepository.update(ownerId, id, c.req.valid('json'))
  if (!updated) return c.json({ error: 'Pantry item not found' }, 404)
  return c.json(updated, 200)
})

// DELETE /v1/pantry/{id}
const deleteRoute = defineRoute({
  method: 'delete',
  path: '/pantry/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: 'Deleted' },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not found or not visible',
    },
  },
})

pantryRoute.openapi(deleteRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const ok = await pantryRepository.remove(ownerId, id)
  if (!ok) return c.json({ error: 'Pantry item not found' }, 404)
  return c.body(null, 204)
})
