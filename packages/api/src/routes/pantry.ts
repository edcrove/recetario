import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { resolveCanonical, rankCookable } from '@recetario/shared'
import { pantryRepository } from '../db/pantry-repository.js'
import { ingredientRepository } from '../db/ingredient-repository.js'
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

// POST /v1/pantry/bulk — upsert several items by name (agent's update_pantry)
const bulkRoute = defineRoute({
  method: 'post',
  path: '/pantry/bulk',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ items: z.array(createBody).min(1) }) } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(pantryItemSchema) } },
      description: 'Items upserted',
    },
  },
})

pantryRoute.openapi(bulkRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { items } = c.req.valid('json')
  return c.json(await pantryRepository.upsert(ownerId, items), 200)
})

// GET /v1/pantry/cookable — recipes ranked by pantry coverage (what_can_i_cook)
const cookableRoute = defineRoute({
  method: 'get',
  path: '/pantry/cookable',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.uuid(),
              title: z.string(),
              matchedCount: z.number().int(),
              totalCount: z.number().int(),
              matchFraction: z.number(),
              missingIngredients: z.array(z.string()),
            }),
          ),
        },
      },
      description: 'Recipes ranked by how many ingredients are in stock',
    },
  },
})

pantryRoute.openapi(cookableRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const maps = await ingredientRepository.loadCanonicalMaps()
  const toKey = (name: string) => resolveCanonical(name, maps.synonyms, maps.canonicals).key
  const pantryKeys = new Set((await pantryRepository.listInStockNames(ownerId)).map(toKey))
  const recipes = await pantryRepository.listHouseholdRecipesWithIngredients(ownerId)
  const ranked = rankCookable(
    recipes.map((r) => ({
      id: r.id,
      title: r.title,
      ingredients: r.ingredients.map((name) => ({ name, key: toKey(name) })),
    })),
    pantryKeys,
  )
  return c.json(ranked, 200)
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
