import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { eq, sql, and, ne } from 'drizzle-orm'
import { getDb, schema } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

export const configRoute = new OpenAPIHono()
configRoute.use('*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const taxonomyItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  usageCount: z.number().int(),
  isDeletable: z.boolean(),
  isSystem: z.boolean().optional(),
})

const taxonomyOverviewSchema = z.object({
  mealCategories: z.array(taxonomyItemSchema),
  foodTypes: z.array(taxonomyItemSchema),
  tags: z.array(taxonomyItemSchema),
})

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
    const db = getDb()

    const mealCategories = await db
      .select({
        id: schema.mealCategories.id,
        name: schema.mealCategories.name,
        slug: schema.mealCategories.slug,
        isSystem: schema.mealCategories.isSystem,
        usageCount: sql<number>`cast(count(${schema.recipes.id}) as int)`,
      })
      .from(schema.mealCategories)
      .leftJoin(
        schema.recipes,
        sql`lower(${schema.recipes.category}) = ${schema.mealCategories.slug}`,
      )
      .groupBy(schema.mealCategories.id)
      .orderBy(schema.mealCategories.name)

    const foodTypes = await db
      .select({
        id: schema.foodTypes.id,
        name: schema.foodTypes.name,
        slug: schema.foodTypes.slug,
        isSystem: schema.foodTypes.isSystem,
        usageCount: sql<number>`cast(count(${schema.recipeFoodTypes.recipeId}) as int)`,
      })
      .from(schema.foodTypes)
      .leftJoin(schema.recipeFoodTypes, eq(schema.recipeFoodTypes.foodTypeId, schema.foodTypes.id))
      .groupBy(schema.foodTypes.id)
      .orderBy(schema.foodTypes.name)

    const tags = await db
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        slug: schema.tags.slug,
        usageCount: sql<number>`cast(count(${schema.recipeTags.recipeId}) as int)`,
      })
      .from(schema.tags)
      .leftJoin(schema.recipeTags, eq(schema.recipeTags.tagId, schema.tags.id))
      .groupBy(schema.tags.id)
      .orderBy(schema.tags.name)

    return c.json({
      mealCategories: mealCategories.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        usageCount: r.usageCount,
        isDeletable: r.usageCount === 0 && !Boolean(r.isSystem),
        isSystem: Boolean(r.isSystem),
      })),
      foodTypes: foodTypes.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        usageCount: r.usageCount,
        isDeletable: r.usageCount === 0 && !Boolean(r.isSystem),
        isSystem: Boolean(r.isSystem),
      })),
      tags: tags.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        usageCount: r.usageCount,
        isDeletable: r.usageCount === 0,
      })),
    })
  },
)

// PATCH /v1/config/:type/:id — rename
configRoute.openapi(
  defineRoute({
    method: 'patch',
    path: '/:type/:id',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({
        type: z.enum(['categories', 'food-types', 'tags']),
        id: z.string().uuid(),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const { type, id } = c.req.valid('param')
    const { name } = c.req.valid('json')
    const db = getDb()
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    if (type === 'categories') {
      const [row] = await db
        .update(schema.mealCategories)
        .set({ name, slug })
        .where(eq(schema.mealCategories.id, id))
        .returning()
      if (!row) return c.json({ error: 'Not found' } as never, 404)
      return c.json({ id: row.id, name: row.name })
    }
    if (type === 'food-types') {
      const [row] = await db
        .update(schema.foodTypes)
        .set({ name, slug })
        .where(eq(schema.foodTypes.id, id))
        .returning()
      if (!row) return c.json({ error: 'Not found' } as never, 404)
      return c.json({ id: row.id, name: row.name })
    }
    // tags
    const [row] = await db
      .update(schema.tags)
      .set({ name, slug })
      .where(eq(schema.tags.id, id))
      .returning()
    if (!row) return c.json({ error: 'Not found' } as never, 404)
    return c.json({ id: row.id, name: row.name })
  },
)

// DELETE /v1/config/:type/:id
configRoute.openapi(
  defineRoute({
    method: 'delete',
    path: '/:type/:id',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({
        type: z.enum(['categories', 'food-types', 'tags']),
        id: z.string().uuid(),
      }),
      query: z.object({ reassignTo: z.string().uuid().optional() }),
    },
    responses: {
      204: { description: 'Deleted' },
      400: { content: { 'application/json': { schema: errorSchema } }, description: 'In use' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const { type, id } = c.req.valid('param')
    const { reassignTo } = c.req.valid('query')
    const db = getDb()

    if (type === 'food-types') {
      const usageCount = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(schema.recipeFoodTypes)
        .where(eq(schema.recipeFoodTypes.foodTypeId, id))
      if (/* v8 ignore next */ (usageCount[0]?.count ?? 0) > 0) {
        if (reassignTo) {
          await db
            .update(schema.recipeFoodTypes)
            .set({ foodTypeId: reassignTo })
            .where(eq(schema.recipeFoodTypes.foodTypeId, id))
        } else {
          await db.delete(schema.recipeFoodTypes).where(eq(schema.recipeFoodTypes.foodTypeId, id))
        }
      }
      const deleted = await db
        .delete(schema.foodTypes)
        .where(and(eq(schema.foodTypes.id, id), ne(sql`${schema.foodTypes.isSystem}`, 1)))
        .returning()
      if (deleted.length === 0) return c.json({ error: 'Not found or system type' } as never, 400)
    } else if (type === 'tags') {
      if (reassignTo) {
        await db
          .update(schema.recipeTags)
          .set({ tagId: reassignTo })
          .where(eq(schema.recipeTags.tagId, id))
      } else {
        await db.delete(schema.recipeTags).where(eq(schema.recipeTags.tagId, id))
      }
      await db.delete(schema.tags).where(eq(schema.tags.id, id))
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
            schema: z.object({ sourceId: z.string().uuid(), targetId: z.string().uuid() }),
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
    },
  }),
  async (c) => {
    const { sourceId, targetId } = c.req.valid('json')
    const db = getDb()
    // Reassign all recipe_tags from source to target (ignore duplicates)
    const rows = await db
      .select()
      .from(schema.recipeTags)
      .where(eq(schema.recipeTags.tagId, sourceId))
    let merged = 0
    for (const row of rows) {
      await db
        .insert(schema.recipeTags)
        .values({ recipeId: row.recipeId, tagId: targetId })
        .onConflictDoNothing()
      merged++
    }
    await db.delete(schema.recipeTags).where(eq(schema.recipeTags.tagId, sourceId))
    await db.delete(schema.tags).where(eq(schema.tags.id, sourceId))
    return c.json({ merged })
  },
)
