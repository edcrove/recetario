import { createRouter } from './router.js'
import { createRoute as defineRoute, z } from '@hono/zod-openapi'
import { TaxonomyItemSchema, TaxonomyOverviewSchema } from '@recetario/shared'
import { configRepository } from '../db/config-repository.js'
import { authMiddleware } from '../middleware/auth.js'

export const configRoute = createRouter()
configRoute.use('*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const taxonomyOverviewSchema = TaxonomyOverviewSchema

// GET /v1/config/taxonomy
configRoute.openapi(
  defineRoute({
    method: 'get',
    path: '/taxonomy',
    security: [{ ApiKeyAuth: [] }],
    responses: {
      200: {
        content: { 'application/json': { schema: taxonomyOverviewSchema } },
        description: 'OK',
      },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    return c.json(await configRepository.overview(ownerId), 200)
  },
)

// POST /v1/config/:type — create one of the caller's own items
configRoute.openapi(
  defineRoute({
    method: 'post',
    path: '/{type}',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({ type: z.enum(['categories', 'food-types', 'tags']) }),
      body: {
        content: { 'application/json': { schema: z.object({ name: z.string().min(1).max(100) }) } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: TaxonomyItemSchema } },
        description: 'Created',
      },
      400: {
        content: { 'application/json': { schema: errorSchema } },
        description: 'Name has no usable characters',
      },
      409: {
        content: { 'application/json': { schema: errorSchema } },
        description: 'Already exists',
      },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { type } = c.req.valid('param')
    const { name } = c.req.valid('json')
    const created = await configRepository.create(type, ownerId, name)
    if (created === 'invalid') return c.json({ error: 'Invalid name' }, 400)
    if (created === 'duplicate') return c.json({ error: 'Already exists' }, 409)
    return c.json(created, 201)
  },
)

// GET /v1/config/:type/:id/recipes — the recipes behind an item's usage badge
configRoute.openapi(
  defineRoute({
    method: 'get',
    path: '/{type}/{id}/recipes',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({
        type: z.enum(['categories', 'food-types', 'tags']),
        id: z.uuid(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.array(z.object({ id: z.uuid(), title: z.string() })) },
        },
        description: 'OK',
      },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { type, id } = c.req.valid('param')
    const recipes = await configRepository.usedBy(type, ownerId, id)
    if (!recipes) return c.json({ error: 'Not found' }, 404)
    return c.json(recipes, 200)
  },
)

// PATCH /v1/config/:type/:id — rename
configRoute.openapi(
  defineRoute({
    method: 'patch',
    path: '/{type}/{id}',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({
        type: z.enum(['categories', 'food-types', 'tags']),
        id: z.uuid(),
      }),
      body: {
        content: { 'application/json': { schema: z.object({ name: z.string().min(1).max(100) }) } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ id: z.string(), name: z.string() }) } },
        description: 'OK',
      },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { type, id } = c.req.valid('param')
    const { name } = c.req.valid('json')
    const row = await configRepository.rename(type, ownerId, id, name)
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row, 200)
  },
)

// DELETE /v1/config/:type/:id
configRoute.openapi(
  defineRoute({
    method: 'delete',
    path: '/{type}/{id}',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({
        type: z.enum(['categories', 'food-types', 'tags']),
        id: z.uuid(),
      }),
      query: z.object({ reassignTo: z.uuid().optional() }),
    },
    responses: {
      204: { description: 'Deleted' },
      400: {
        content: { 'application/json': { schema: errorSchema } },
        description: 'System item or invalid reassignTo',
      },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { type, id } = c.req.valid('param')
    const { reassignTo } = c.req.valid('query')
    const outcome =
      type === 'food-types'
        ? await configRepository.deleteFoodType(ownerId, id, reassignTo)
        : type === 'tags'
          ? await configRepository.deleteTag(ownerId, id, reassignTo)
          : await configRepository.deleteCategory(ownerId, id, reassignTo)
    if (outcome === 'bad_target') return c.json({ error: 'Invalid reassignTo' }, 400)
    if (outcome === 'not_found') {
      // Tags have no system rows; for the others a system item is "not deletable"
      return type === 'tags'
        ? c.json({ error: 'Not found' }, 404)
        : c.json(
            { error: `Not found or system ${type === 'food-types' ? 'type' : 'category'}` },
            400,
          )
    }
    return c.body(null, 204)
  },
)

// POST /v1/config/tags/merge
configRoute.openapi(
  defineRoute({
    method: 'post',
    path: '/tags/merge',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ sourceId: z.uuid(), targetId: z.uuid() }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ merged: z.number() }) } },
        description: 'Merged',
      },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { sourceId, targetId } = c.req.valid('json')
    const merged = await configRepository.mergeTags(ownerId, sourceId, targetId)
    if (merged === null) return c.json({ error: 'Tag not found' }, 404)
    return c.json({ merged }, 200)
  },
)
