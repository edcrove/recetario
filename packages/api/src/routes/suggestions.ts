import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  resolveCanonical,
  rankSuggestions,
  computeDayNutrition,
  type MacroTotals,
} from '@recetario/shared'
import { pantryRepository } from '../db/pantry-repository.js'
import { ingredientRepository } from '../db/ingredient-repository.js'
import { menuRepository } from '../db/menu-repository.js'
import { authMiddleware } from '../middleware/auth.js'
import '../types.js'

export const suggestionsRoute = new OpenAPIHono()
suggestionsRoute.use('/suggestions/*', authMiddleware)

const bodySchema = z
  .object({
    ingredients: z.array(z.string().min(1)).optional(),
    usePantry: z.boolean().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine((b) => (b.ingredients && b.ingredients.length > 0) || b.usePantry, {
    message: 'Provide ingredients[] or usePantry: true',
  })

const suggestionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  matchedCount: z.number().int(),
  totalCount: z.number().int(),
  matchFraction: z.number(),
  missingIngredients: z.array(z.string()),
  goalFit: z.enum(['dentro', 'cerca', 'lejos']).nullable(),
  nutrition: z
    .object({
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
    })
    .nullable(),
})

// POST /v1/suggestions/from-ingredients
const route = defineRoute({
  method: 'post',
  path: '/suggestions/from-ingredients',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: bodySchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(suggestionSchema) } },
      description: 'Recipes ranked by cookability and goal fit',
    },
    400: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Neither ingredients nor pantry provided',
    },
  },
})

suggestionsRoute.openapi(route, async (c) => {
  const ownerId = c.get('ownerId')
  const { ingredients, usePantry, date } = c.req.valid('json')
  const maps = await ingredientRepository.loadCanonicalMaps()
  const toKey = (name: string) => resolveCanonical(name, maps.synonyms, maps.canonicals).key

  // What the user has: the ad-hoc list, plus the in-stock pantry when asked.
  const haveNames = [...(ingredients ?? [])]
  if (usePantry) haveNames.push(...(await pantryRepository.listInStockNames(ownerId)))
  const haveKeys = new Set(haveNames.map(toKey))

  // Remaining daily goal for the given date (null when no date or no target).
  let remaining: MacroTotals | null = null
  if (date) {
    const { entries, target } = await menuRepository.getDayNutritionInputs(ownerId, date)
    const day = computeDayNutrition(entries, target)
    if (day.target) {
      remaining = {
        calories: day.target.calories - day.totals.calories,
        protein_g: day.target.protein_g - day.totals.protein_g,
        carbs_g: day.target.carbs_g - day.totals.carbs_g,
        fat_g: day.target.fat_g - day.totals.fat_g,
      }
    }
  }

  const recipes = await pantryRepository.listHouseholdRecipesWithIngredients(ownerId)
  const ranked = rankSuggestions(
    recipes.map((r) => ({
      id: r.id,
      title: r.title,
      ingredients: r.ingredients.map((name) => ({ name, key: toKey(name) })),
      nutrition: r.nutrition,
    })),
    haveKeys,
    remaining,
  )
  return c.json(ranked, 200)
})
