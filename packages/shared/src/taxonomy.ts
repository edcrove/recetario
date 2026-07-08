import { z } from 'zod'

// ── Meal categories (replaces CategorySchema enum) ───────────────────────────
export const MealCategorySchema = z.object({
  id: z.uuid(),
  ownerId: z.string().nullable(),
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50),
  color: z.string().optional(),
  isSystem: z.boolean(),
})
export type MealCategory = z.infer<typeof MealCategorySchema>

export const CreateMealCategorySchema = MealCategorySchema.pick({ name: true, color: true })
export type CreateMealCategory = z.infer<typeof CreateMealCategorySchema>

// System slugs kept for backward compat
export const SYSTEM_CATEGORY_SLUGS = [
  'desayuno',
  'almuerzo',
  'cena',
  'postre',
  'snack',
  'bebida',
  'otro',
] as const

// ── Food types ───────────────────────────────────────────────────────────────
export const FoodTypeSchema = z.object({
  id: z.uuid(),
  ownerId: z.string().nullable(),
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50),
  isSystem: z.boolean(),
})
export type FoodType = z.infer<typeof FoodTypeSchema>

export const CreateFoodTypeSchema = FoodTypeSchema.pick({ name: true })
export type CreateFoodType = z.infer<typeof CreateFoodTypeSchema>

export const SYSTEM_FOOD_TYPE_SLUGS = [
  'guiso',
  'sopa',
  'carne',
  'minuta',
  'ensalada',
  'pasta',
  'postre',
  'bebida',
  'saludable',
  'panificado',
  'tarta',
] as const

// ── Tags ─────────────────────────────────────────────────────────────────────
export const TagSchema = z.object({
  id: z.uuid(),
  ownerId: z.string(),
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50),
})
export type Tag = z.infer<typeof TagSchema>

// ── Collections ──────────────────────────────────────────────────────────────
export const CollectionSchema = z.object({
  id: z.uuid(),
  ownerId: z.string(),
  name: z.string().min(1).max(100),
  emoji: z.string().max(4).optional(),
  description: z.string().max(500).optional(),
  recipeCount: z.number().int().default(0),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})
export type Collection = z.infer<typeof CollectionSchema>

export const CreateCollectionSchema = CollectionSchema.pick({
  name: true,
  emoji: true,
  description: true,
})
export type CreateCollection = z.infer<typeof CreateCollectionSchema>

// ── Recipe relations ─────────────────────────────────────────────────────────
export const RelationTypeSchema = z.enum(['similar', 'variation', 'inspiration'])
export type RelationType = z.infer<typeof RelationTypeSchema>

export const RecipeRelationSchema = z.object({
  fromId: z.uuid(),
  toId: z.uuid(),
  relationType: RelationTypeSchema,
  createdBy: z.enum(['user', 'agent']).default('user'),
})
export type RecipeRelation = z.infer<typeof RecipeRelationSchema>

// ── Cook sessions ────────────────────────────────────────────────────────────
export const CookSessionSchema = z.object({
  id: z.uuid(),
  // Nullable: deleting a recipe sets this to null instead of destroying the
  // session (see 2026-07-03 audit finding). recipeTitle is a snapshot from
  // when the session was logged, so history stays readable either way.
  recipeId: z.uuid().nullable(),
  recipeTitle: z.string().nullable().optional(),
  ownerId: z.string(),
  cookedAt: z.string().datetime(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().max(1000).nullable(),
  createdAt: z.string().datetime().optional(),
})
export type CookSession = z.infer<typeof CookSessionSchema>

export const CreateCookSessionSchema = z.object({
  recipeId: z.uuid(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(1000).optional(),
})
export type CreateCookSession = z.infer<typeof CreateCookSessionSchema>

// ── Taxonomy usage stats ──────────────────────────────────────────────────────
export const TaxonomyItemWithUsageSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  usageCount: z.number().int(),
  isDeletable: z.boolean(),
  isSystem: z.boolean().optional(),
})
export type TaxonomyItemWithUsage = z.infer<typeof TaxonomyItemWithUsageSchema>

export const TaxonomyOverviewSchema = z.object({
  mealCategories: z.array(TaxonomyItemWithUsageSchema),
  foodTypes: z.array(TaxonomyItemWithUsageSchema),
  tags: z.array(TaxonomyItemWithUsageSchema),
})
export type TaxonomyOverview = z.infer<typeof TaxonomyOverviewSchema>
