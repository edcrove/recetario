import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ingredientRepository } from '../db/ingredient-repository.js'
import { authMiddleware } from '../middleware/auth.js'
import '../types.js'

// so /ingredients/unmatched isn't shadowed by /ingredients/{...} param routes,
// static routes are declared before dynamic ones below.

export const ingredientsRoute = new OpenAPIHono()
ingredientsRoute.use('/ingredients', authMiddleware)
ingredientsRoute.use('/ingredients/*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const synonymSchema = z.object({
  id: z.uuid(),
  synonym: z.string(),
  isSystem: z.boolean(),
})

const canonicalSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  normalizedName: z.string(),
  familyId: z.uuid().nullable(),
  familyName: z.string().nullable(),
  isSystem: z.boolean(),
  synonyms: z.array(synonymSchema),
})

// GET /v1/ingredients — canonicals with synonyms + family (for the config UI)
const listRoute = defineRoute({
  method: 'get',
  path: '/ingredients',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(canonicalSchema) } },
      description: 'Canonical ingredients with their synonyms',
    },
  },
})

ingredientsRoute.openapi(listRoute, async (c) => {
  const list = await ingredientRepository.listCanonicals()
  return c.json(list, 200)
})

// GET /v1/ingredients/unmatched — caller's recipe ingredients with no canonical
const unmatchedRoute = defineRoute({
  method: 'get',
  path: '/ingredients/unmatched',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(
            z.object({ name: z.string(), normalized: z.string(), count: z.number().int() }),
          ),
        },
      },
      description: 'Unmatched ingredient names with frequency',
    },
  },
})

ingredientsRoute.openapi(unmatchedRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const list = await ingredientRepository.listUnmatchedIngredients(ownerId)
  return c.json(list, 200)
})

// POST /v1/ingredients/canonical — create a canonical
const createCanonicalRoute = defineRoute({
  method: 'post',
  path: '/ingredients/canonical',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1),
            familyId: z.uuid().nullable().optional(),
            // Agent-friendly alternative to familyId: resolves (or creates) by name.
            familyName: z.string().min(1).optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ id: z.uuid(), name: z.string(), normalizedName: z.string() }),
        },
      },
      description: 'Canonical created (or existing returned)',
    },
  },
})

ingredientsRoute.openapi(createCanonicalRoute, async (c) => {
  const { name, familyId, familyName } = c.req.valid('json')
  const resolvedFamilyId = familyName
    ? await ingredientRepository.findOrCreateFamily(familyName)
    : (familyId ?? null)
  const created = await ingredientRepository.createCanonical(name, resolvedFamilyId)
  return c.json(created, 200)
})

// POST /v1/ingredients/synonym — map a surface string to a canonical
const setSynonymRoute = defineRoute({
  method: 'post',
  path: '/ingredients/synonym',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              surface: z.string().min(1),
              canonicalId: z.uuid().optional(),
              // Agent-friendly alternative to canonicalId.
              canonicalName: z.string().min(1).optional(),
            })
            .refine((b) => b.canonicalId || b.canonicalName, {
              message: 'canonicalId or canonicalName is required',
            }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ id: z.uuid(), synonym: z.string() }) },
      },
      description: 'Synonym mapped',
    },
    400: { content: { 'application/json': { schema: errorSchema } }, description: 'Empty surface' },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Canonical not found',
    },
  },
})

ingredientsRoute.openapi(setSynonymRoute, async (c) => {
  const { surface, canonicalId, canonicalName } = c.req.valid('json')
  const resolvedId = canonicalName
    ? (await ingredientRepository.findCanonicalByName(canonicalName))?.id
    : (await ingredientRepository.getCanonicalById(canonicalId!))?.id
  if (!resolvedId) return c.json({ error: 'Canonical not found' }, 404)
  const result = await ingredientRepository.setSynonym(surface, resolvedId)
  if (!result) return c.json({ error: 'Surface normalizes to empty' }, 400)
  return c.json(result, 200)
})

// DELETE /v1/ingredients/canonical/{id} — remove a non-system canonical
const deleteCanonicalRoute = defineRoute({
  method: 'delete',
  path: '/ingredients/canonical/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: 'Deleted' },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not found or system-protected',
    },
  },
})

ingredientsRoute.openapi(deleteCanonicalRoute, async (c) => {
  const { id } = c.req.valid('param')
  const ok = await ingredientRepository.deleteCanonical(id)
  if (!ok) return c.json({ error: 'Not found or system-protected' }, 404)
  return c.body(null, 204)
})

// DELETE /v1/ingredients/synonym/{id} — remove a non-system synonym
const deleteSynonymRoute = defineRoute({
  method: 'delete',
  path: '/ingredients/synonym/{id}',
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: 'Deleted' },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Not found or system-protected',
    },
  },
})

ingredientsRoute.openapi(deleteSynonymRoute, async (c) => {
  const { id } = c.req.valid('param')
  const ok = await ingredientRepository.deleteSynonym(id)
  if (!ok) return c.json({ error: 'Not found or system-protected' }, 404)
  return c.body(null, 204)
})
