import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  MenuEntrySchema,
  MenuSlotSchema,
  CreateMenuEntrySchema,
  aggregateIngredients,
  enrichShoppingList,
  resolveCanonical,
  computeMenuGaps,
  computeDayNutrition,
} from '@recetario/shared'
import { ingredientRepository } from '../db/ingredient-repository.js'
import { pantryRepository } from '../db/pantry-repository.js'
import { menuRepository } from '../db/menu-repository.js'
import { isViewerAnywhere } from '../db/household-visibility.js'
import { authMiddleware } from '../middleware/auth.js'
import { getDb, schema as dbSchema } from '../db/index.js'
import { eq, and, gte, lte } from 'drizzle-orm'
import '../types.js'

export const menuRoute = new OpenAPIHono()

menuRoute.use('/menu', authMiddleware)
menuRoute.use('/menu/*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

// POST /v1/menu — add recipe to slot (multiple allowed per slot)
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
      description: 'Menu entry added',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Validation error',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Household viewers cannot modify the menu',
    },
  },
})

menuRoute.openapi(postMenuRoute, async (c) => {
  const ownerId = c.get('ownerId')
  // A viewer's entries would surface in their household's shared week view,
  // so viewers are read-only on the menu (see household-visibility.ts).
  if (await isViewerAnywhere(ownerId)) return c.json({ error: 'Forbidden' }, 403)
  const body = c.req.valid('json')
  const entry = await menuRepository.upsert(ownerId, body)
  return c.json(entry, 200)
})

// DELETE /v1/menu/:date/:slot/:recipeId — remove specific recipe from slot
const deleteMenuEntryRoute = defineRoute({
  method: 'delete',
  path: '/menu/{date}/{slot}/{recipeId}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: MenuSlotSchema,
      recipeId: z.uuid(),
    }),
  },
  responses: {
    204: { description: 'Entry removed' },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Household viewers cannot modify the menu',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Entry not found',
    },
  },
})

menuRoute.openapi(deleteMenuEntryRoute, async (c) => {
  const ownerId = c.get('ownerId')
  if (await isViewerAnywhere(ownerId)) return c.json({ error: 'Forbidden' }, 403)
  const { date, slot, recipeId } = c.req.valid('param')
  const deleted = await menuRepository.remove(ownerId, date, slot, recipeId)
  if (!deleted) return c.json({ error: 'Menu entry not found' }, 404)
  return new Response(null, { status: 204 })
})

// DELETE /v1/menu/:date/:slot — remove all recipes from slot (backward compat)
const deleteMenuSlotRoute = defineRoute({
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
    204: { description: 'Slot cleared' },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Household viewers cannot modify the menu',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'No entries found',
    },
  },
})

menuRoute.openapi(deleteMenuSlotRoute, async (c) => {
  const ownerId = c.get('ownerId')
  if (await isViewerAnywhere(ownerId)) return c.json({ error: 'Forbidden' }, 403)
  const { date, slot } = c.req.valid('param')
  const deleted = await menuRepository.remove(ownerId, date, slot)
  if (!deleted) return c.json({ error: 'Menu entry not found' }, 404)
  return new Response(null, { status: 204 })
})

// PATCH /v1/menu/:date/:slot/:recipeId — update servings for a specific recipe
const patchMenuEntryRoute = defineRoute({
  method: 'patch',
  path: '/menu/{date}/{slot}/{recipeId}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: MenuSlotSchema,
      recipeId: z.uuid(),
    }),
    body: {
      content: { 'application/json': { schema: z.object({ servings: z.number().int().min(1) }) } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MenuEntrySchema } },
      description: 'Entry updated',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Household viewers cannot modify the menu',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Entry not found',
    },
  },
})

menuRoute.openapi(patchMenuEntryRoute, async (c) => {
  const ownerId = c.get('ownerId')
  if (await isViewerAnywhere(ownerId)) return c.json({ error: 'Forbidden' }, 403)
  const { date, slot, recipeId } = c.req.valid('param')
  const { servings } = c.req.valid('json')
  const entry = await menuRepository.updateServings(ownerId, date, slot, recipeId, servings)
  if (!entry) return c.json({ error: 'Menu entry not found' }, 404)
  return c.json(entry, 200)
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
  key: z.string(),
  aisle: z.string(),
  checked: z.boolean(),
  pantryMatch: z.boolean(),
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
  // Group by canonical ingredient so "suprema de pollo" and "pechuga" combine
  // into one "Pollo" line while "muslo" stays separate.
  const maps = await ingredientRepository.loadCanonicalMaps()
  const resolve = (name: string) => {
    const { key } = resolveCanonical(name, maps.synonyms, maps.canonicals)
    return { key, display: maps.displayByKey.get(key) ?? name.trim() }
  }
  const items = aggregateIngredients(scaled, resolve)
  const checkedKeys = await menuRepository.getShoppingChecks(ownerId, weekStart)
  // Mark items the household already has: resolve in-stock pantry names to the
  // same canonical keys the list uses.
  const pantryNames = await pantryRepository.listInStockNames(ownerId)
  const pantryKeys = new Set(
    pantryNames.map((n) => resolveCanonical(n, maps.synonyms, maps.canonicals).key),
  )
  const list = enrichShoppingList(items, checkedKeys, pantryKeys)
  return c.json(list, 200)
})

// PUT /v1/menu/shopping-list/check — persist a per-item check-off for the week
const putShoppingCheckRoute = defineRoute({
  method: 'put',
  path: '/menu/shopping-list/check',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            key: z.string().min(1),
            checked: z.boolean(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } },
      description: 'Check state persisted',
    },
  },
})

menuRoute.openapi(putShoppingCheckRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { weekStart, key, checked } = c.req.valid('json')
  await menuRepository.setShoppingCheck(ownerId, weekStart, key, checked)
  return c.json({ ok: true }, 200)
})

// GET /v1/menu/missing-ingredients — what's still needed to cook the planned week
const mealGapSchema = z.object({
  date: z.string(),
  slot: z.string(),
  recipeId: z.uuid().nullable(),
  recipeName: z.string().optional(),
  cookable: z.boolean(),
  missingIngredients: z.array(z.string()),
})

const getMissingRoute = defineRoute({
  method: 'get',
  path: '/menu/missing-ingredients',
  security: [{ ApiKeyAuth: [] }],
  request: { query: z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            missing: z.array(ShoppingListItemSchema),
            meals: z.array(mealGapSchema),
          }),
        },
      },
      description: 'Combined missing shopping items + per-meal cookability',
    },
  },
})

menuRoute.openapi(getMissingRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { weekStart } = c.req.valid('query')
  const maps = await ingredientRepository.loadCanonicalMaps()
  const toKey = (name: string) => resolveCanonical(name, maps.synonyms, maps.canonicals).key
  const pantryKeys = new Set((await pantryRepository.listInStockNames(ownerId)).map(toKey))

  // Combined week total, minus what the pantry already covers.
  const scaled = await menuRepository.getScaledIngredients(ownerId, weekStart)
  const resolve = (name: string) => {
    const key = toKey(name)
    return { key, display: maps.displayByKey.get(key) ?? name.trim() }
  }
  const enriched = enrichShoppingList(aggregateIngredients(scaled, resolve), new Set(), pantryKeys)
  const missing = enriched.filter((i) => !i.pantryMatch)

  // Which planned meals are cookable now.
  const week = await menuRepository.getWeek(ownerId, weekStart)
  const recipes = await pantryRepository.listHouseholdRecipesWithIngredients(ownerId)
  const ingsByRecipe = new Map(recipes.map((r) => [r.id, r.ingredients]))
  const meals = computeMenuGaps(
    week.map((e) => ({
      date: e.date,
      slot: e.slot,
      recipeId: e.recipeId,
      recipeName: e.recipeName,
      ingredients: (e.recipeId ? (ingsByRecipe.get(e.recipeId) ?? []) : []).map((name) => ({
        name,
        key: toKey(name),
      })),
    })),
    pantryKeys,
  )
  return c.json({ missing, meals }, 200)
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
    // Nutrition is stored per serving; a day's contribution is per-serving ×
    // planned servings (NOT divided by recipeServings — that was a scaling bug).
    const s = entry.servings
    const day = dayMap.get(entry.date) ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    day.calories += Math.round(n.calories * s)
    day.protein_g += Math.round(n.protein_g * s * 10) / 10
    day.carbs_g += Math.round(n.carbs_g * s * 10) / 10
    day.fat_g += Math.round(n.fat_g * s * 10) / 10
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

// GET /v1/menu/day-nutrition — one day's macro rollup with signed delta vs the
// user's daily target, per-meal breakdown, and a partial flag when a planned
// recipe lacks nutrition data. Household-shared reads.
const macroTotalsSchema = z.object({
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
})
const dayNutritionResponseSchema = z.object({
  date: z.string(),
  totals: macroTotalsSchema,
  target: macroTotalsSchema.nullable(),
  delta: z
    .object({
      calories: z.number().nullable(),
      protein_g: z.number().nullable(),
      carbs_g: z.number().nullable(),
      fat_g: z.number().nullable(),
    })
    .nullable(),
  byMeal: z.array(z.object({ mealCategory: z.string(), totals: macroTotalsSchema })),
  partial: z.boolean(),
  missingCount: z.number(),
})

const getDayNutritionRoute = defineRoute({
  method: 'get',
  path: '/menu/day-nutrition',
  security: [{ ApiKeyAuth: [] }],
  request: { query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) },
  responses: {
    200: {
      content: { 'application/json': { schema: dayNutritionResponseSchema } },
      description: 'Day macro rollup with delta vs target',
    },
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
menuRoute.openapi(getDayNutritionRoute as any, async (c: any) => {
  const ownerId = c.get('ownerId')
  const { date } = c.req.valid('query')
  const { entries, target } = await menuRepository.getDayNutritionInputs(ownerId, date)
  return c.json({ date, ...computeDayNutrition(entries, target) })
})
