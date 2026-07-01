import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  MenuEntrySchema,
  MenuSlotSchema,
  CreateMenuEntrySchema,
  aggregateIngredients,
} from '@recetario/shared'
import { menuRepository } from '../db/menu-repository.js'
import { authMiddleware } from '../middleware/auth.js'
import { getDb, schema as dbSchema } from '../db/index.js'
import { eq, and, gte, lte } from 'drizzle-orm'
import '../types.js'

export const menuRoute = new OpenAPIHono()

menuRoute.use('/menu', authMiddleware)
menuRoute.use('/menu/*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

// POST /v1/menu — upsert entry
const postMenuRoute = defineRoute({
  method: 'post',
  path: '/menu',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateMenuEntrySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MenuEntrySchema } },
      description: 'Menu entry upserted',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Validation error',
    },
  },
})

menuRoute.openapi(postMenuRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const body = c.req.valid('json')
  const entry = await menuRepository.upsert(ownerId, body)
  return c.json(entry, 200)
})

// DELETE /v1/menu/:date/:slot — remove entry
const deleteMenuRoute = defineRoute({
  method: 'delete',
  path: '/menu/{date}/{slot}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: MenuSlotSchema,
    }),
  },
  responses: {
    204: { description: 'Entry removed' },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Entry not found',
    },
  },
})

menuRoute.openapi(deleteMenuRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { date, slot } = c.req.valid('param')
  const deleted = await menuRepository.remove(ownerId, date, slot)
  if (!deleted) return c.json({ error: 'Menu entry not found' }, 404)
  return new Response(null, { status: 204 })
})

// GET /v1/menu — get week entries
const getMenuRoute = defineRoute({
  method: 'get',
  path: '/menu',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(MenuEntrySchema) } },
      description: 'Menu entries for the week',
    },
  },
})

menuRoute.openapi(getMenuRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { weekStart } = c.req.valid('query')
  const entries = await menuRepository.getWeek(ownerId, weekStart)
  return c.json(entries, 200)
})

// GET /v1/menu/shopping-list — generate shopping list from planned week
const ShoppingListItemSchema = z.object({
  ingredient: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
})

const getShoppingListRoute = defineRoute({
  method: 'get',
  path: '/menu/shopping-list',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(ShoppingListItemSchema) } },
      description: 'Aggregated shopping list for the week',
    },
  },
})

menuRoute.openapi(getShoppingListRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { weekStart } = c.req.valid('query')
  const scaled = await menuRepository.getScaledIngredients(ownerId, weekStart)
  const list = aggregateIngredients(scaled)
  return c.json(list, 200)
})

// GET /v1/menu/nutrition — daily nutrition totals vs user targets
const dayNutritionSchema = z.object({
  date: z.string(),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
})

const nutritionWeekSchema = z.object({
  weekStart: z.string(),
  days: z.array(dayNutritionSchema),
  targets: z
    .object({
      daily_calories: z.number(),
      daily_protein_g: z.number(),
      daily_carbs_g: z.number(),
      daily_fat_g: z.number(),
    })
    .nullable(),
})

const getMenuNutritionRoute = defineRoute({
  method: 'get',
  path: '/menu/nutrition',
  security: [{ ApiKeyAuth: [] }],
  request: { query: z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) },
  responses: {
    200: { content: { 'application/json': { schema: nutritionWeekSchema } }, description: 'OK' },
    400: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Bad request',
    },
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
menuRoute.openapi(getMenuNutritionRoute as any, async (c: any) => {
  const ownerId = c.get('ownerId')
  const { weekStart } = c.req.valid('query')
  const db = getDb()

  const weekStartDate = new Date(weekStart + 'T00:00:00Z')
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6)
  const weekEnd = weekEndDate.toISOString().slice(0, 10)

  // Get menu entries for the week with recipe nutrition
  const entries = await db
    .select({
      date: dbSchema.menuEntries.date,
      servings: dbSchema.menuEntries.servings,
      recipeServings: dbSchema.recipes.servings,
      nutrition: dbSchema.recipes.nutrition,
    })
    .from(dbSchema.menuEntries)
    .innerJoin(dbSchema.recipes, eq(dbSchema.menuEntries.recipeId, dbSchema.recipes.id))
    .where(
      and(
        eq(dbSchema.menuEntries.ownerId, ownerId),
        gte(dbSchema.menuEntries.date, weekStart),
        lte(dbSchema.menuEntries.date, weekEnd),
      ),
    )

  // Get user nutrition targets
  const [profile] = await db
    .select({ nutritionTargets: dbSchema.userProfiles.nutritionTargets })
    .from(dbSchema.userProfiles)
    .where(eq(dbSchema.userProfiles.userId, ownerId))
    .limit(1)

  // Aggregate per day
  const dayMap = new Map<
    string,
    { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  >()

  for (const entry of entries) {
    const n = entry.nutrition as {
      calories: number
      protein_g: number
      carbs_g: number
      fat_g: number
    } | null
    if (!n) continue
    const scale = entry.recipeServings > 0 ? entry.servings / entry.recipeServings : 1
    const day = dayMap.get(entry.date) ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    day.calories += Math.round(n.calories * scale)
    day.protein_g += Math.round(n.protein_g * scale * 10) / 10
    day.carbs_g += Math.round(n.carbs_g * scale * 10) / 10
    day.fat_g += Math.round(n.fat_g * scale * 10) / 10
    dayMap.set(entry.date, day)
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate)
    d.setUTCDate(d.getUTCDate() + i)
    const date = d.toISOString().slice(0, 10)
    return { date, ...(dayMap.get(date) ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }) }
  })

  return c.json({
    weekStart,
    days,
    targets:
      (profile?.nutritionTargets as {
        daily_calories: number
        daily_protein_g: number
        daily_carbs_g: number
        daily_fat_g: number
      } | null) ?? null,
  })
})
