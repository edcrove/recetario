import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  RecipeSchema,
  CreateRecipeSchema,
  UpdateRecipeSchema,
  LibraryRecipeSchema,
} from '@recetario/shared'
import { recipeRepository } from '../db/repository.js'
import { getVisibleOwnerIds } from '../db/household-visibility.js'
import { authMiddleware } from '../middleware/auth.js'
import { rateLimitMiddleware } from '../middleware/rateLimit.js'
import '../types.js'

export const recipesRoute = new OpenAPIHono()

// Auth on all /v1/recipes routes
recipesRoute.use('/recipes', authMiddleware)
recipesRoute.use('/recipes/*', authMiddleware)

recipesRoute.use('/library', authMiddleware)

// Rate limit on write operations (/recipes POST and /recipes/:id PUT+DELETE)
recipesRoute.use('/recipes/:id', rateLimitMiddleware)
recipesRoute.use('/recipes', rateLimitMiddleware)

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
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Validation error',
    },
  },
})

recipesRoute.openapi(postRecipeRoute, async (c) => {
  const ownerId = c.get('ownerId')
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
      dietary: z.string().optional(),
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
  const ownerId = c.get('ownerId')
  const { q, tag, category, ingredient, dietary } = c.req.valid('query')
  const visibleOwners = await getVisibleOwnerIds(ownerId)
  const recipes = await recipeRepository.search(visibleOwners, {
    q,
    tag,
    category,
    ingredient,
    dietary,
  })
  return c.json(recipes, 200)
})

// GET /v1/recipes — list (200)
const listRecipesRoute = defineRoute({
  method: 'get',
  path: '/recipes',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      limit: z.coerce.number().int().positive().max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
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
  const ownerId = c.get('ownerId')
  const { limit, offset } = c.req.valid('query')
  const visibleOwners = await getVisibleOwnerIds(ownerId)
  const recipes = await recipeRepository.list(visibleOwners, { limit, offset })
  return c.json(recipes, 200)
})

// GET /v1/recipes/:id — get by id (200 / 404)
const getRecipeByIdRoute = defineRoute({
  method: 'get',
  path: '/recipes/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
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
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const visibleOwners = await getVisibleOwnerIds(ownerId)
  const recipe = await recipeRepository.findById(id, visibleOwners)
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404)
  return c.json(recipe, 200)
})

// PUT /v1/recipes/:id — update (200 / 404)
const putRecipeRoute = defineRoute({
  method: 'put',
  path: '/recipes/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
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
  const ownerId = c.get('ownerId')
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
    params: z.object({ id: z.uuid() }),
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
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const deleted = await recipeRepository.delete(id, ownerId)
  if (!deleted) return c.json({ error: 'Recipe not found' }, 404)
  return new Response(null, { status: 204 })
})

// GET /v1/library — public recipes from every owner (the shared library)
const getLibraryRoute = defineRoute({
  method: 'get',
  path: '/library',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      search: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(LibraryRecipeSchema) } },
      description: 'Public recipes with author display names',
    },
  },
})

recipesRoute.openapi(getLibraryRoute, async (c) => {
  const { search, limit, offset } = c.req.valid('query')
  const recipes = await recipeRepository.findPublic({ search, limit, offset })
  return c.json(recipes, 200)
})

// POST /v1/recipes/:id/copy — fork a readable recipe into the caller's own
// collection (snapshot semantics: edits to the copy never touch the original)
const copyRecipeRoute = defineRoute({
  method: 'post',
  path: '/recipes/{id}/copy',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
  },
  responses: {
    201: {
      content: { 'application/json': { schema: RecipeSchema } },
      description: 'Fork created, owned by the caller, private, with provenance',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Recipe not found or not readable by the caller',
    },
  },
})

recipesRoute.openapi(copyRecipeRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const fork = await recipeRepository.copyAsFork(id, ownerId)
  if (!fork) return c.json({ error: 'Recipe not found' }, 404)
  return c.json(fork, 201)
})
