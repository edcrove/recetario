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

// Source
export const SourceSchema = z.object({
  type: z.enum(['url', 'photo', 'manual', 'mcp']),
  url: z.string().url().optional(),
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
  durationMin: z.number().positive().optional(),
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
  id: z.string().uuid().optional(), // optional on create
  title: z.string().min(1),
  servings: z.number().int().positive(),
  category: CategorySchema,
  tags: z.array(z.string()).default([]),
  prepTimeMin: z.number().int().positive().optional(),
  cookTimeMin: z.number().int().positive().optional(),
  totalTimeMin: z.number().int().positive().optional(),
  images: z.array(z.string().url()).default([]),
  notes: z.string().optional(),
  yield: z.string().optional(), // "12 cookies"
  originalLanguage: z.string().default('es'),
  translations: z.array(TranslationSchema).default([]),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(StepSchema).default([]),
  source: SourceSchema.optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})
export type Recipe = z.infer<typeof RecipeSchema>

// CreateRecipe — omit server-set fields
export const CreateRecipeSchema = RecipeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type CreateRecipe = z.infer<typeof CreateRecipeSchema>

// UpdateRecipe — all optional partial
export const UpdateRecipeSchema = CreateRecipeSchema.partial()
export type UpdateRecipe = z.infer<typeof UpdateRecipeSchema>
