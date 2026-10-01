import { z } from 'zod'

// URLs we store and later open or render (recipe source, images, avatars) must be
// http(s): a bare z.url() also accepts javascript:, data:, file:, etc.
export const HTTP_URL_PROTOCOL = /^https?$/
export const HttpUrlSchema = z.url({ protocol: HTTP_URL_PROTOCOL })

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
  // Optional label nutrients (2026-10-01 audit): only stored when known.
  sugars_g: z.number().min(0).optional(),
  saturated_fat_g: z.number().min(0).optional(),
  sodium_mg: z.number().min(0).optional(),
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
// keyed by menu slot (Desayuno/Almuerzo/Merienda/Cena; see mealTargetFor). Stored in the
// existing user_profiles.nutrition_targets jsonb — per_meal is additive and
// backward compatible, so no migration.
// Upper bounds well above any real adult need; they catch typos (20000 kcal).
export const NutritionTargetsSchema = z.object({
  daily_calories: z.number().int().min(0).max(10000),
  daily_protein_g: z.number().min(0).max(600),
  daily_carbs_g: z.number().min(0).max(1500),
  daily_fat_g: z.number().min(0).max(600),
  per_meal: z.record(z.string(), MealTargetSchema).optional(),
})
export type NutritionTargets = z.infer<typeof NutritionTargetsSchema>

/** kcal implied by macros (Atwater: 4 kcal/g protein and carbs, 9 kcal/g fat). */
export function atwaterKcal(m: { protein_g: number; carbs_g: number; fat_g: number }): number {
  return Math.round(m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9)
}

/**
 * Starting targets for a typical adult: 2000 kcal whose macros add up
 * (75 g protein 15% · 250 g carbs 50% · 78 g fat 35% ≈ 2002 kcal).
 */
export const DEFAULT_NUTRITION_TARGETS = {
  daily_calories: 2000,
  daily_protein_g: 75,
  daily_carbs_g: 250,
  daily_fat_g: 78,
} as const

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
  url: HttpUrlSchema.optional(),
  author: z.string().optional(),
  externalId: z.string().optional(),
})
export type Source = z.infer<typeof SourceSchema>

// Ingredient
export const IngredientSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().positive().nullable(), // null = "to taste"
  unit: UnitSchema.nullable(),
  presentation: z.string().optional(), // "diced", "melted", etc.
  group: z.string().optional(), // "For the sauce"
  note: z.string().optional(),
})
export type Ingredient = z.infer<typeof IngredientSchema>

// Step
export const StepSchema = z.object({
  text: z.string().min(1).max(4000),
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
  title: z.string().min(1).max(200),
  servings: z.number().int().positive(),
  category: CategorySchema,
  tags: z.array(z.string().max(50)).max(30).default([]),
  prepTimeMin: z.number().int().positive().optional(),
  cookTimeMin: z.number().int().positive().optional(),
  totalTimeMin: z.number().int().positive().optional(),
  difficulty: z.enum(['fácil', 'media', 'difícil']).optional(),
  images: z.array(HttpUrlSchema).default([]),
  notes: z.string().max(10000).optional(),
  yield: z.string().optional(), // "12 cookies"
  originalLanguage: z.string().default('es'),
  translations: z.array(TranslationSchema).default([]),
  ingredients: z.array(IngredientSchema).min(1).max(200),
  steps: z.array(StepSchema).max(150).default([]),
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
  // null clears stale nutrition ("sin datos") — see nutritionAfterEdit
  nutrition: NutritionSchema.nullable().optional(),
})
export type CreateRecipe = z.infer<typeof CreateRecipeSchema>

// UpdateRecipe — all optional partial. The defaulted fields are re-declared
// WITHOUT .default(): Zod 4 keeps defaults inside .partial(), so `{ title }`
// used to parse as `{ title, tags: [], images: [], steps: [], … }` and the
// repository (which treats any defined field as "replace") wiped them.
// Omitted must mean "leave unchanged".
export const UpdateRecipeSchema = CreateRecipeSchema.extend({
  tags: z.array(z.string().max(50)).max(30),
  images: z.array(HttpUrlSchema),
  originalLanguage: z.string(),
  translations: z.array(TranslationSchema),
  steps: z.array(StepSchema).max(150),
}).partial()
export type UpdateRecipe = z.infer<typeof UpdateRecipeSchema>
