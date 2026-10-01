import { createRouter } from './router.js'
import { createRoute as defineRoute, z } from '@hono/zod-openapi'
import { accountRepository } from '../db/account-repository.js'
import {
  ALLERGENS,
  HTTP_URL_PROTOCOL,
  NutritionTargetsSchema,
  UserSchema,
  ProfileSchema,
  toAllergenKey,
} from '@recetario/shared'
import { authMiddleware } from '../middleware/auth.js'

/** True for IANA zone names the runtime knows ("America/Montevideo", "UTC"). */
function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const profileRoute = createRouter()

// Mounted on /auth next to login/register: scope auth to this router's own paths
profileRoute.use('/me', authMiddleware)
profileRoute.use('/profile', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const userPatchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.url({ protocol: HTTP_URL_PROTOCOL }).optional(),
})

const userResponseSchema = UserSchema

const profileSchema = ProfileSchema

// PATCH /auth/me
const patchMeRoute = defineRoute({
  method: 'patch',
  path: '/me',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: userPatchSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: userResponseSchema } },
      description: 'Updated',
    },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
  },
})

profileRoute.openapi(patchMeRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const updates = c.req.valid('json')
  const user = await accountRepository.updateUser(ownerId, updates)

  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    },
    200,
  )
})

// GET /auth/profile
const getProfileRoute = defineRoute({
  method: 'get',
  path: '/profile',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: profileSchema } }, description: 'OK' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
  },
})

profileRoute.openapi(getProfileRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const profile = await accountRepository.findProfile(ownerId)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)
  return c.json(profile, 200)
})

// PATCH /auth/profile
const VALID_DIETARY = [
  'vegano',
  'vegetariano',
  'sin-gluten',
  'sin-lactosa',
  'keto',
  'paleo',
] as const

const patchProfileRoute = defineRoute({
  method: 'patch',
  path: '/profile',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            preferredServings: z.number().int().min(1).max(20).optional(),
            dietaryRestrictions: z.array(z.enum(VALID_DIETARY)).optional(),
            allergens: z
              .array(z.string().min(1).max(50))
              .optional()
              .describe(
                `Allergen keys (${ALLERGENS.join(', ')}). Spanish names such as "maní" or "lácteos" are mapped to their key.`,
              ),
            goals: z.array(z.string().min(1).max(100)).optional(),
            timezone: z
              .string()
              .refine(isTimeZone, { message: 'Unknown IANA time zone' })
              .optional(),
            nutritionTargets: NutritionTargetsSchema.optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: profileSchema } }, description: 'Updated' },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Unknown allergen',
    },
  },
})

profileRoute.openapi(patchProfileRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const body = c.req.valid('json')

  let updates = body
  if (body.allergens) {
    const keys = body.allergens.map(toAllergenKey)
    const unknown = body.allergens.filter((_, i) => keys[i] === null)
    if (unknown.length > 0) {
      return c.json(
        { error: `Unknown allergen: ${unknown.join(', ')}. Use one of: ${ALLERGENS.join(', ')}` },
        400,
      )
    }
    updates = { ...body, allergens: [...new Set(keys as string[])] }
  }

  return c.json(await accountRepository.upsertProfile(ownerId, updates), 200)
})
