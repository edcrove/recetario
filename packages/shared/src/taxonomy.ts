import { z } from 'zod'

// Response contracts for the taxonomy configurator, food types, collections,
// recipe relations, suggestions and cook history, shared by the API (OpenAPI
// responses) and the app client so they can't drift (2026-10-01 audit: the API
// declared these in its route files, the app re-typed them by hand, and the
// schemas that used to live here matched neither).

/** One row of the taxonomy configurator. Tags have no system rows, so no `isSystem`. */
export const TaxonomyItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  usageCount: z.number().int(),
  isDeletable: z.boolean(),
  isSystem: z.boolean().optional(),
})
export type TaxonomyItem = z.infer<typeof TaxonomyItemSchema>

export const TaxonomyOverviewSchema = z.object({
  mealCategories: z.array(TaxonomyItemSchema),
  foodTypes: z.array(TaxonomyItemSchema),
  tags: z.array(TaxonomyItemSchema),
})
export type TaxonomyOverview = z.infer<typeof TaxonomyOverviewSchema>

export const ConfigTypeSchema = z.enum(['categories', 'food-types', 'tags'])
export type ConfigType = z.infer<typeof ConfigTypeSchema>

export const FoodTypeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  isSystem: z.boolean(),
})
export type FoodType = z.infer<typeof FoodTypeSchema>

export const CollectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  emoji: z.string().nullable(),
  description: z.string().nullable(),
  recipeCount: z.number().int(),
  createdAt: z.string(),
})
export type Collection = z.infer<typeof CollectionSchema>

export const RelationTypeSchema = z.enum(['similar', 'variation', 'inspiration'])
export type RelationType = z.infer<typeof RelationTypeSchema>

export const RecipeRelationSchema = z.object({
  fromId: z.uuid(),
  toId: z.uuid(),
  relationType: RelationTypeSchema,
  createdBy: z.string(),
  // The related recipe's title, so clients can show it without a second fetch
  toTitle: z.string().optional(),
})
export type RecipeRelation = z.infer<typeof RecipeRelationSchema>

/** A recipe ranked by "what can I cook with what I have". */
export const SuggestionSchema = z.object({
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
  usesExpiring: z.array(z.string()),
  recentlyCooked: z.boolean(),
  avgRating: z.number().nullable(),
})
export type Suggestion = z.infer<typeof SuggestionSchema>

export const CookSessionSchema = z.object({
  id: z.uuid(),
  recipeId: z.uuid().nullable(),
  recipeTitle: z.string().nullable().optional(),
  ownerId: z.string(),
  cookedAt: z.string(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  servings: z.number().int().nullable().optional(),
  source: z.string().nullable().optional(),
  createdAt: z.string(),
})
export type CookSession = z.infer<typeof CookSessionSchema>

export const CookStatsSchema = z.object({
  // Every figure covers the same window: `since` (default: last 90 days)
  since: z.string(),
  totalSessions: z.number().int(),
  topRecipes: z.array(
    z.object({
      recipeId: z.uuid().nullable(),
      title: z.string().nullable(),
      count: z.number().int(),
      lastCookedAt: z.string(),
    }),
  ),
  frequencyByWeek: z.array(z.object({ week: z.string(), count: z.number().int() })),
  // Days in the person's time zone; not limited to the window (a streak can be older)
  streak: z.object({ current: z.number().int(), longest: z.number().int() }),
})
export type CookStats = z.infer<typeof CookStatsSchema>
