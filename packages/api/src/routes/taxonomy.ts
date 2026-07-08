import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { eq, and, sql, or, isNull } from 'drizzle-orm'
import { RecipeSchema } from '@recetario/shared'
import { getDb, schema } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { recipeRepository } from '../db/repository.js'

export const taxonomyRoute = new OpenAPIHono()
taxonomyRoute.use('*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const foodTypeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  isSystem: z.boolean(),
})

// GET /v1/food-types
taxonomyRoute.openapi(
  defineRoute({
    method: 'get',
    path: '/food-types',
    security: [{ ApiKeyAuth: [] }],
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(foodTypeSchema) } },
        description: 'OK',
      },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const db = getDb()
    const rows = await db
      .select()
      .from(schema.foodTypes)
      .where(or(eq(schema.foodTypes.ownerId, ownerId), isNull(schema.foodTypes.ownerId)))
      .orderBy(schema.foodTypes.name)
    return c.json(
      rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, isSystem: Boolean(r.isSystem) })),
    )
  },
)

// POST /v1/food-types (user-defined)
taxonomyRoute.openapi(
  defineRoute({
    method: 'post',
    path: '/food-types',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: z.object({ name: z.string().min(1).max(50) }) } },
        required: true,
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: foodTypeSchema } }, description: 'Created' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { name } = c.req.valid('json')
    const db = getDb()
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    const [row] = await db
      .insert(schema.foodTypes)
      .values({ name, slug, ownerId, isSystem: 0 })
      .returning()
    return c.json({ id: row!.id, name: row!.name, slug: row!.slug, isSystem: false }, 201)
  },
)

const collectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  emoji: z.string().nullable(),
  description: z.string().nullable(),
  recipeCount: z.number().int(),
  createdAt: z.string(),
})

// GET /v1/collections
taxonomyRoute.openapi(
  defineRoute({
    method: 'get',
    path: '/collections',
    security: [{ ApiKeyAuth: [] }],
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(collectionSchema) } },
        description: 'OK',
      },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const db = getDb()
    const rows = await db
      .select({
        id: schema.collections.id,
        name: schema.collections.name,
        emoji: schema.collections.emoji,
        description: schema.collections.description,
        recipeCount: sql<number>`cast(count(${schema.recipeCollections.recipeId}) as int)`,
        createdAt: schema.collections.createdAt,
      })
      .from(schema.collections)
      .leftJoin(
        schema.recipeCollections,
        eq(schema.recipeCollections.collectionId, schema.collections.id),
      )
      .where(eq(schema.collections.ownerId, ownerId))
      .groupBy(schema.collections.id)
      .orderBy(schema.collections.name)
    return c.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })))
  },
)

// POST /v1/collections
taxonomyRoute.openapi(
  defineRoute({
    method: 'post',
    path: '/collections',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(100),
              emoji: z.string().max(4).optional(),
              description: z.string().max(500).optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: collectionSchema } },
        description: 'Created',
      },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const body = c.req.valid('json')
    const db = getDb()
    const [row] = await db
      .insert(schema.collections)
      .values({ ...body, ownerId })
      .returning()
    return c.json(
      {
        id: row!.id,
        name: row!.name,
        emoji: row!.emoji ?? null,
        description: row!.description ?? null,
        recipeCount: 0,
        createdAt: row!.createdAt.toISOString(),
      },
      201,
    )
  },
)

// POST /v1/collections/:id/recipes
taxonomyRoute.openapi(
  defineRoute({
    method: 'post',
    path: '/collections/:id/recipes',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({ id: z.uuid() }),
      body: {
        content: { 'application/json': { schema: z.object({ recipeId: z.uuid() }) } },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ collectionId: z.string(), recipeId: z.string() }),
          },
        },
        description: 'Added',
      },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { id } = c.req.valid('param')
    const { recipeId } = c.req.valid('json')
    const db = getDb()
    const [col] = await db
      .select()
      .from(schema.collections)
      .where(and(eq(schema.collections.id, id), eq(schema.collections.ownerId, ownerId)))
      .limit(1)
    if (!col) return c.json({ error: 'Collection not found' } as never, 404)
    await db
      .insert(schema.recipeCollections)
      .values({ collectionId: id, recipeId })
      .onConflictDoNothing()
    return c.json({ collectionId: id, recipeId }, 201)
  },
)

// GET /v1/collections/:id/recipes
const collectionRecipesRoute = defineRoute({
  method: 'get',
  path: '/collections/:id/recipes',
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(RecipeSchema) } },
      description: 'OK',
    },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
taxonomyRoute.openapi(collectionRecipesRoute as any, async (c: any) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const db = getDb()
  const [col] = await db
    .select()
    .from(schema.collections)
    .where(and(eq(schema.collections.id, id), eq(schema.collections.ownerId, ownerId)))
    .limit(1)
  if (!col) return c.json({ error: 'Collection not found' } as never, 404)

  const links = await db
    .select({ recipeId: schema.recipeCollections.recipeId })
    .from(schema.recipeCollections)
    .where(eq(schema.recipeCollections.collectionId, id))

  const recipes = await Promise.all(
    links.map((link) => recipeRepository.findById(link.recipeId, ownerId)),
  )
  return c.json(recipes.filter((r): r is NonNullable<typeof r> => r !== null))
})

// DELETE /v1/collections/:id/recipes/:recipeId
taxonomyRoute.openapi(
  defineRoute({
    method: 'delete',
    path: '/collections/:id/recipes/:recipeId',
    security: [{ ApiKeyAuth: [] }],
    request: { params: z.object({ id: z.uuid(), recipeId: z.uuid() }) },
    responses: {
      204: { description: 'Removed' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { id, recipeId } = c.req.valid('param')
    const db = getDb()
    const [col] = await db
      .select()
      .from(schema.collections)
      .where(and(eq(schema.collections.id, id), eq(schema.collections.ownerId, ownerId)))
      .limit(1)
    if (!col) return c.json({ error: 'Collection not found' } as never, 404)
    await db
      .delete(schema.recipeCollections)
      .where(
        and(
          eq(schema.recipeCollections.collectionId, id),
          eq(schema.recipeCollections.recipeId, recipeId),
        ),
      )
    return c.body(null, 204)
  },
)

const relationSchema = z.object({
  fromId: z.uuid(),
  toId: z.uuid(),
  relationType: z.enum(['similar', 'variation', 'inspiration']),
  createdBy: z.string(),
})

// POST /v1/recipes/:id/relations
taxonomyRoute.openapi(
  defineRoute({
    method: 'post',
    path: '/recipes/:id/relations',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({ id: z.uuid() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              toId: z.uuid(),
              relationType: z.enum(['similar', 'variation', 'inspiration']),
              createdBy: z.enum(['user', 'agent']).default('user'),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: { content: { 'application/json': { schema: relationSchema } }, description: 'Created' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { id } = c.req.valid('param')
    const { toId, relationType, createdBy = 'user' } = c.req.valid('json')
    const recipe = await recipeRepository.findById(id, ownerId)
    if (!recipe) return c.json({ error: 'Recipe not found' } as never, 404)
    const db = getDb()
    await db
      .insert(schema.recipeRelations)
      .values({ fromId: id, toId, relationType, createdBy })
      .onConflictDoNothing()
    return c.json({ fromId: id, toId, relationType, createdBy }, 201)
  },
)

// GET /v1/recipes/:id/relations
taxonomyRoute.openapi(
  defineRoute({
    method: 'get',
    path: '/recipes/:id/relations',
    security: [{ ApiKeyAuth: [] }],
    request: { params: z.object({ id: z.uuid() }) },
    responses: {
      200: {
        content: { 'application/json': { schema: z.array(relationSchema) } },
        description: 'OK',
      },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { id } = c.req.valid('param')
    const recipe = await recipeRepository.findById(id, ownerId)
    if (!recipe) return c.json({ error: 'Recipe not found' } as never, 404)
    const db = getDb()
    const rows = await db
      .select()
      .from(schema.recipeRelations)
      .where(eq(schema.recipeRelations.fromId, id))
    return c.json(
      rows.map((r) => ({
        fromId: r.fromId,
        toId: r.toId,
        relationType: r.relationType as 'similar' | 'variation' | 'inspiration',
        createdBy: r.createdBy,
      })),
      200,
    )
  },
)
