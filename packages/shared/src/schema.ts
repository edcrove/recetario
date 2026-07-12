import { z } from 'zod'

// Unit enum — covers volume, mass, count, and presentation-only
export const UnitSchema = z.enum([
  // Volume
  'tsp',
  'tbsp',
  'cup',
  'ml',
  'l',
  // Mass
  'g',
  'kg',
  // Count / generic
  'unit',
  'pinch',
  'slice',
  'clove',
])
export type Unit = z.infer<typeof UnitSchema>

// Dietary tags
export const DIETARY_TAGS = [
  'vegano',
  'vegetariano',
  'sin-gluten',
  'sin-lactosa',
  'keto',
  'paleo',
] as const
export const DietaryTagSchema = z.enum(DIETARY_TAGS)
export type DietaryTag = z.infer<typeof DietaryTagSchema>

// Nutrition per serving
export const NutritionSchema = z.object({
  calories: z.number().min(0),
  protein_g: z.number().min(0),
  carbs_g: z.number().min(0),
  fat_g: z.number().min(0),
  fiber_g: z.number().min(0).optional(),
})
export type Nutrition = z.infer<typeof NutritionSchema>

// A per-meal macro goal — every field optional (set only what matters).
export const MealTargetSchema = z.object({
  calories: z.number().min(0).optional(),
  protein_g: z.number().min(0).optional(),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
})
export type MealTarget = z.infer<typeof MealTargetSchema>

// Nutrition targets: daily (required baseline) plus optional per-meal goals
// keyed by meal category slug (desayuno/almuerzo/cena/...). Stored in the
// existing user_profiles.nutrition_targets jsonb — per_meal is additive and
// backward compatible, so no migration.
export const NutritionTargetsSchema = z.object({
  daily_calories: z.number().int().min(0),
  daily_protein_g: z.number().min(0),
  daily_carbs_g: z.number().min(0),
  daily_fat_g: z.number().min(0),
  per_meal: z.record(z.string(), MealTargetSchema).optional(),
})
export type NutritionTargets = z.infer<typeof NutritionTargetsSchema>

// Category enum
export const CategorySchema = z.enum([
  'Desayuno',
  'Almuerzo',
  'Cena',
  'Postre',
  'Snack',
  'Bebida',
  'Otro',
])
export type Category = z.infer<typeof CategorySchema>

// Visibility — 'private' is visible to the owner (and, once household sharing
// lands, their household); 'public' additionally lists the recipe in the
// public library where anyone can copy it as a fork.
export const RecipeVisibilitySchema = z.enum(['private', 'public'])
export type RecipeVisibility = z.infer<typeof RecipeVisibilitySchema>

// Source
export const SourceSchema = z.object({
  type: z.enum(['url', 'photo', 'manual', 'mcp']),
  url: z.url().optional(),
  author: z.string().optional(),
  externalId: z.string().optional(),
})
export type Source = z.infer<typeof SourceSchema>

// Ingredient
export const IngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().nullable(), // null = "to taste"
  unit: UnitSchema.nullable(),
  presentation: z.string().optional(), // "diced", "melted", etc.
  group: z.string().optional(), // "For the sauce"
  note: z.string().optional(),
})
export type Ingredient = z.infer<typeof IngredientSchema>

// Step
export const StepSchema = z.object({
  text: z.string().min(1),
  // Auto-detected (or agent-set) timer duration in seconds; drives cook-mode
  // tap-to-start timers. See parseStepDurationSeconds.
  durationSeconds: z.number().int().positive().optional(),
  ovenTempC: z.number().optional(),
})
export type Step = z.infer<typeof StepSchema>

// Translation
export const TranslationSchema = z.object({
  language: z.string().min(2).max(5), // BCP-47 e.g. "es", "en"
  title: z.string().optional(),
  notes: z.string().optional(),
})

// Recipe (full)
export const RecipeSchema = z.object({
  id: z.uuid().optional(), // optional on create
  title: z.string().min(1),
  servings: z.number().int().positive(),
  category: CategorySchema,
  tags: z.array(z.string()).default([]),
  prepTimeMin: z.number().int().positive().optional(),
  cookTimeMin: z.number().int().positive().optional(),
  totalTimeMin: z.number().int().positive().optional(),
  difficulty: z.enum(['fácil', 'media', 'difícil']).optional(),
  images: z.array(z.url()).default([]),
  notes: z.string().optional(),
  yield: z.string().optional(), // "12 cookies"
  originalLanguage: z.string().default('es'),
  translations: z.array(TranslationSchema).default([]),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(StepSchema).default([]),
  source: SourceSchema.optional(),
  dietaryTags: z.array(DietaryTagSchema).optional(),
  nutrition: NutritionSchema.optional(),
  foodTypeIds: z.array(z.uuid()).max(3).optional(),
  // optional on input; the DB defaults it to 'private', so API responses always carry it
  visibility: RecipeVisibilitySchema.optional(),
  // server-managed: set only by the copy/fork endpoint, never by clients
  forkedFromId: z.uuid().nullable().optional(),
  // server-set: lets the app distinguish own recipes from housemates' ones.
  // Stripped from public-library responses (only the display name may leak).
  ownerId: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})
export type Recipe = z.infer<typeof RecipeSchema>
export type RecipeDifficulty = NonNullable<Recipe['difficulty']>

// Library listing — a public recipe plus its author's display name. Only the
// display name (fallback 'Anónimo') crosses the tenant boundary: never emails
// or user ids.
export const LibraryRecipeSchema = RecipeSchema.extend({
  author: z.string(),
})
export type LibraryRecipe = z.infer<typeof LibraryRecipeSchema>

// CreateRecipe — omit server-set fields
export const CreateRecipeSchema = RecipeSchema.omit({
  id: true,
  forkedFromId: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Times/difficulty accept null on INPUT so the edit form can CLEAR a value.
  // On a partial update, `undefined` means "leave unchanged" while `null` means
  // "clear this field" — without null there is no way to unset a time/difficulty.
  // (RecipeSchema itself keeps these as number|undefined for read responses.)
  prepTimeMin: z.number().int().positive().nullable().optional(),
  cookTimeMin: z.number().int().positive().nullable().optional(),
  totalTimeMin: z.number().int().positive().nullable().optional(),
  difficulty: z.enum(['fácil', 'media', 'difícil']).nullable().optional(),
})
export type CreateRecipe = z.infer<typeof CreateRecipeSchema>

// UpdateRecipe — all optional partial
export const UpdateRecipeSchema = CreateRecipeSchema.partial()
export type UpdateRecipe = z.infer<typeof UpdateRecipeSchema>
