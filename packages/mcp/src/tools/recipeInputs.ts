import { z } from 'zod'
import {
  CategorySchema,
  SYSTEM_CATEGORIES,
  CreateRecipeSchema,
  DietaryTagSchema,
  IngredientSchema,
  NutritionSchema,
  RecipeVisibilitySchema,
  StepSchema,
  UnitSchema,
} from '@recetario/shared'

// Agent-facing recipe inputs built from the shared domain schemas, so the MCP
// contract cannot drift from what the API validates (units, categories, diets,
// limits). Only descriptions are added here.

export const IngredientInput = IngredientSchema.extend({
  name: IngredientSchema.shape.name.describe('Ingredient name'),
  quantity: IngredientSchema.shape.quantity.describe('Amount (null for "to taste")'),
  unit: UnitSchema.nullable().describe(
    'Unit of measurement (null for countable items or "to taste")',
  ),
  presentation: IngredientSchema.shape.presentation.describe(
    'How prepared: "diced", "melted", etc.',
  ),
  group: IngredientSchema.shape.group.describe('Ingredient group: "For the sauce"'),
})

export const StepInput = StepSchema.extend({
  text: StepSchema.shape.text.describe('Step instructions'),
  durationSeconds: StepSchema.shape.durationSeconds.describe(
    'Timer duration for this step in SECONDS (e.g. 40 min → 2400). Set it when the step has a clear time so cook mode can offer a tap-to-start timer. If omitted, the API auto-detects it from the step text.',
  ),
  ovenTempC: StepSchema.shape.ovenTempC.describe('Oven temperature in °C, if the step uses it'),
})

export const CategoryInput = CategorySchema.describe(
  `Meal category: a system one (${SYSTEM_CATEGORIES.join(', ')}) or one of your own (listTaxonomy, createTaxonomyItem)`,
)

export const DietaryTagsInput = z
  .array(DietaryTagSchema)
  .describe(
    'Diets this recipe satisfies. Only tag what the ingredients allow: the API rejects a tag an ingredient contradicts (e.g. vegano with chorizo, sin-gluten with harina de trigo).',
  )

export const NutritionInput = NutritionSchema.extend({
  calories: NutritionSchema.shape.calories.describe('Calories per serving'),
  protein_g: NutritionSchema.shape.protein_g.describe('Protein grams per serving'),
  carbs_g: NutritionSchema.shape.carbs_g.describe('Carbohydrate grams per serving'),
  fat_g: NutritionSchema.shape.fat_g.describe('Fat grams per serving'),
  fiber_g: NutritionSchema.shape.fiber_g.describe('Fiber grams per serving'),
  sugars_g: NutritionSchema.shape.sugars_g.describe('Sugars grams per serving (if known)'),
  saturated_fat_g: NutritionSchema.shape.saturated_fat_g.describe(
    'Saturated fat grams per serving (if known)',
  ),
  sodium_mg: NutritionSchema.shape.sodium_mg.describe('Sodium milligrams per serving (if known)'),
}).describe('Nutrition facts per serving (not per whole recipe)')

export const FoodTypeIdsInput = z
  .array(z.uuid())
  .max(3)
  .describe('Up to 3 food type IDs from getFoodTypes (e.g. guiso, sopa, carne)')

// null clears the value on update; omitted leaves it unchanged.
export const DifficultyInput = CreateRecipeSchema.shape.difficulty.describe(
  'Difficulty: fácil, media or difícil (null clears it)',
)

export const VisibilityInput = RecipeVisibilitySchema

/** Readable lists for error suggestions, straight from the shared enums. */
export const CATEGORY_LIST = SYSTEM_CATEGORIES.join(', ')
export const UNIT_LIST = UnitSchema.options.join(', ')
