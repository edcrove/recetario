import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db/index.js'
import { NutritionTargetsSchema } from '@recetario/shared'
import { authMiddleware } from '../middleware/auth.js'

export const profileRoute = new OpenAPIHono()

profileRoute.use('*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const userPatchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.url().optional(),
})

const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
})

const nutritionTargetsSchema = NutritionTargetsSchema.nullable()

const profileSchema = z.object({
  preferredServings: z.number().int().min(1).max(20).nullable(),
  dietaryRestrictions: z.array(z.string()),
  allergens: z.array(z.string()),
  goals: z.array(z.string()),
  timezone: z.string().nullable(),
  nutritionTargets: nutritionTargetsSchema,
})

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
profileRoute.openapi(patchMeRoute as any, async (c: any) => {
  const ownerId = c.get('ownerId')
  const updates = c.req.valid('json')
  const db = getDb()

  const [user] = await db
    .update(schema.users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(schema.users.id, ownerId))
    .returning()

  if (!user) return c.json({ error: 'User not found' } as never, 404)

  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  })
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
profileRoute.openapi(getProfileRoute as any, async (c: any) => {
  const ownerId = c.get('ownerId')
  const db = getDb()

  const [profile] = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, ownerId))
    .limit(1)

  if (!profile) return c.json({ error: 'Profile not found' } as never, 404)

  return c.json({
    preferredServings: profile.preferredServings,
    dietaryRestrictions: (profile.dietaryRestrictions as string[]) ?? [],
    allergens: (profile.allergens as string[]) ?? [],
    goals: (profile.goals as string[]) ?? [],
    timezone: profile.timezone,
    nutritionTargets:
      (profile.nutritionTargets as {
        daily_calories: number
        daily_protein_g: number
        daily_carbs_g: number
        daily_fat_g: number
      } | null) ?? null,
  })
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
            allergens: z.array(z.string().min(1).max(50)).optional(),
            goals: z.array(z.string().min(1).max(100)).optional(),
            timezone: z.string().optional(),
            nutritionTargets: NutritionTargetsSchema.optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: profileSchema } }, description: 'Updated' },
  },
})

profileRoute.openapi(patchProfileRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const updates = c.req.valid('json')
  const db = getDb()

  await db
    .insert(schema.userProfiles)
    .values({ userId: ownerId, ...updates })
    .onConflictDoUpdate({
      target: schema.userProfiles.userId,
      set: updates,
    })

  const [profile] = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, ownerId))
    .limit(1)

  return c.json({
    preferredServings: profile?.preferredServings ?? null,
    dietaryRestrictions: (profile?.dietaryRestrictions as string[]) ?? [],
    allergens: (profile?.allergens as string[]) ?? [],
    goals: (profile?.goals as string[]) ?? [],
    timezone: profile?.timezone ?? null,
    nutritionTargets:
      (profile?.nutritionTargets as import('@recetario/shared').NutritionTargets | null) ?? null,
  })
})
