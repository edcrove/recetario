import { createRouter } from './router.js'
import { createRoute as defineRoute, z } from '@hono/zod-openapi'
import {
  RecipeSchema,
  FoodTypeSchema,
  CollectionSchema,
  RecipeRelationSchema,
} from '@recetario/shared'
import { taxonomyRepository } from '../db/taxonomy-repository.js'
import { authMiddleware } from '../middleware/auth.js'
import { recipeRepository } from '../db/repository.js'

export const taxonomyRoute = createRouter()
// Scoped to this router's own paths: it's mounted on the shared /v1 prefix, and a
// '*' here would also run auth for every other /v1 router (and 401 unknown paths)
for (const path of ['/food-types', '/collections', '/collections/*', '/recipes/:id/relations']) {
  taxonomyRoute.use(path, authMiddleware)
}

const errorSchema = z.object({ error: z.string() })

const foodTypeSchema = FoodTypeSchema

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
    return c.json(await taxonomyRepository.listFoodTypes(ownerId), 200)
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
        content: {
          'application/json': { schema: z.object({ name: z.string().trim().min(1).max(50) }) },
        },
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
    return c.json(await taxonomyRepository.createFoodType(ownerId, name), 201)
  },
)

const collectionSchema = CollectionSchema

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
    return c.json(await taxonomyRepository.listCollections(ownerId), 200)
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
              name: z.string().trim().min(1).max(100),
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
    return c.json(await taxonomyRepository.createCollection(ownerId, body), 201)
  },
)

// DELETE /v1/collections/:id — removes the collection (and its links), never the recipes
taxonomyRoute.openapi(
  defineRoute({
    method: 'delete',
    path: '/collections/{id}',
    security: [{ ApiKeyAuth: [] }],
    request: { params: z.object({ id: z.uuid() }) },
    responses: {
      204: { description: 'Deleted' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { id } = c.req.valid('param')
    if (!(await taxonomyRepository.deleteCollection(ownerId, id)))
      return c.json({ error: 'Collection not found' }, 404)
    return c.body(null, 204)
  },
)

// POST /v1/collections/:id/recipes
taxonomyRoute.openapi(
  defineRoute({
    method: 'post',
    path: '/collections/{id}/recipes',
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
    if (!(await taxonomyRepository.ownsCollection(ownerId, id)))
      return c.json({ error: 'Collection not found' }, 404)
    // The recipe must be readable by the caller (own or household-shared);
    // without this any recipeId could be linked into a collection (IDOR).
    const recipe = await recipeRepository.findById(recipeId, { visibleTo: ownerId })
    if (!recipe) return c.json({ error: 'Recipe not found' }, 404)
    await taxonomyRepository.addRecipeToCollection(id, recipeId)
    return c.json({ collectionId: id, recipeId }, 201)
  },
)

// GET /v1/collections/:id/recipes
const collectionRecipesRoute = defineRoute({
  method: 'get',
  path: '/collections/{id}/recipes',
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

taxonomyRoute.openapi(collectionRecipesRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  if (!(await taxonomyRepository.ownsCollection(ownerId, id)))
    return c.json({ error: 'Collection not found' }, 404)

  // Recipes are household-shared, so a collection listing must resolve each
  // linked recipe against the caller's full visible-owner set — otherwise a
  // housemate's recipe added to the collection silently vanishes from the list.
  const recipes = await recipeRepository.findByIds(
    await taxonomyRepository.collectionRecipeIds(id),
    { visibleTo: ownerId },
  )
  return c.json(recipes, 200)
})

// DELETE /v1/collections/:id/recipes/:recipeId
taxonomyRoute.openapi(
  defineRoute({
    method: 'delete',
    path: '/collections/{id}/recipes/{recipeId}',
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
    if (!(await taxonomyRepository.ownsCollection(ownerId, id)))
      return c.json({ error: 'Collection not found' }, 404)
    await taxonomyRepository.removeRecipeFromCollection(id, recipeId)
    return c.body(null, 204)
  },
)

const relationSchema = RecipeRelationSchema

// POST /v1/recipes/:id/relations
taxonomyRoute.openapi(
  defineRoute({
    method: 'post',
    path: '/recipes/{id}/relations',
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
      400: {
        content: { 'application/json': { schema: errorSchema } },
        description: 'A recipe related to itself',
      },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const ownerId = c.get('ownerId')
    const { id } = c.req.valid('param')
    const { toId, relationType, createdBy = 'user' } = c.req.valid('json')
    const recipe = await recipeRepository.findById(id, { ownedBy: ownerId })
    if (!recipe) return c.json({ error: 'Recipe not found' }, 404)
    if (toId === id) return c.json({ error: 'A recipe cannot be related to itself' }, 400)
    // The related recipe must be one the caller can open (own or household)
    const to = await recipeRepository.findById(toId, { visibleTo: ownerId })
    if (!to) return c.json({ error: 'Related recipe not found' }, 404)
    await taxonomyRepository.addRelation({ fromId: id, toId, relationType, createdBy })
    return c.json({ fromId: id, toId, relationType, createdBy, toTitle: to.title }, 201)
  },
)

// GET /v1/recipes/:id/relations
taxonomyRoute.openapi(
  defineRoute({
    method: 'get',
    path: '/recipes/{id}/relations',
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
    const recipe = await recipeRepository.findById(id, { ownedBy: ownerId })
    if (!recipe) return c.json({ error: 'Recipe not found' }, 404)
    const relations = await taxonomyRepository.listRelations(id)
    // Only recipes the caller can open, each with its title
    const visible = await recipeRepository.findByIds(
      relations.map((r) => r.toId),
      { visibleTo: ownerId },
    )
    const titles = new Map(visible.map((r) => [r.id, r.title]))
    return c.json(
      relations
        .filter((r) => titles.has(r.toId))
        .map((r) => ({ ...r, toTitle: titles.get(r.toId) })),
      200,
    )
  },
)
