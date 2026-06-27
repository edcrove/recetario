import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { RecipeSchema, CreateRecipeSchema, UpdateRecipeSchema } from '@recetario/shared'
import { recipeRepository } from '../db/repository.js'
import '../types.js'

export const recipesRoute = new OpenAPIHono()

const errorSchema = z.object({ error: z.string(), details: z.unknown().optional() })

// POST /v1/recipes — create or upsert (201 new, 200 dedupe)
const postRecipeRoute = defineRoute({
  method: 'post',
  path: '/recipes',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateRecipeSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: RecipeSchema } },
      description: 'Recipe created',
    },
    200: {
      content: { 'application/json': { schema: RecipeSchema } },
      description: 'Recipe updated (dedupe upsert)',
    },
    422: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Validation error',
    },
  },
})

recipesRoute.openapi(postRecipeRoute, async (c) => {
  const ownerId = c.get('ownerId') ?? 'dev'
  const body = c.req.valid('json')

  const { recipe, created } = await recipeRepository.upsert(ownerId, body)
  return created ? c.json(recipe, 201) : c.json(recipe, 200)
})

// GET /v1/recipes/search — search (must come before /:id)
const searchRecipesRoute = defineRoute({
  method: 'get',
  path: '/recipes/search',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      q: z.string().optional(),
      tag: z.string().optional(),
      category: z.string().optional(),
      ingredient: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(RecipeSchema) } },
      description: 'Search results',
    },
  },
})

recipesRoute.openapi(searchRecipesRoute, async (c) => {
  const ownerId = c.get('ownerId') ?? 'dev'
  const { q, tag, category, ingredient } = c.req.valid('query')
  const recipes = await recipeRepository.search(ownerId, { q, tag, category, ingredient })
  return c.json(recipes, 200)
})

// GET /v1/recipes — list (200)
const listRecipesRoute = defineRoute({
  method: 'get',
  path: '/recipes',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      limit: z.coerce.number().int().positive().max(100).default(20).optional(),
      offset: z.coerce.number().int().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(RecipeSchema) } },
      description: 'List of recipes',
    },
  },
})

recipesRoute.openapi(listRecipesRoute, async (c) => {
  const ownerId = c.get('ownerId') ?? 'dev'
  const { limit, offset } = c.req.valid('query')
  const recipes = await recipeRepository.list(ownerId, { limit, offset })
  return c.json(recipes, 200)
})

// GET /v1/recipes/:id — get by id (200 / 404)
const getRecipeByIdRoute = defineRoute({
  method: 'get',
  path: '/recipes/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: RecipeSchema } },
      description: 'Recipe found',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Recipe not found',
    },
  },
})

recipesRoute.openapi(getRecipeByIdRoute, async (c) => {
  const ownerId = c.get('ownerId') ?? 'dev'
  const { id } = c.req.valid('param')
  const recipe = await recipeRepository.findById(id, ownerId)
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404)
  return c.json(recipe, 200)
})

// PUT /v1/recipes/:id — update (200 / 404)
const putRecipeRoute = defineRoute({
  method: 'put',
  path: '/recipes/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: UpdateRecipeSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: RecipeSchema } },
      description: 'Recipe updated',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Recipe not found',
    },
  },
})

recipesRoute.openapi(putRecipeRoute, async (c) => {
  const ownerId = c.get('ownerId') ?? 'dev'
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const recipe = await recipeRepository.update(id, ownerId, body)
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404)
  return c.json(recipe, 200)
})

// DELETE /v1/recipes/:id — delete (204 / 404)
const deleteRecipeRoute = defineRoute({
  method: 'delete',
  path: '/recipes/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    204: {
      description: 'Recipe deleted',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Recipe not found',
    },
  },
})

recipesRoute.openapi(deleteRecipeRoute, async (c) => {
  const ownerId = c.get('ownerId') ?? 'dev'
  const { id } = c.req.valid('param')
  const deleted = await recipeRepository.delete(id, ownerId)
  if (!deleted) return c.json({ error: 'Recipe not found' }, 404)
  return new Response(null, { status: 204 })
})
