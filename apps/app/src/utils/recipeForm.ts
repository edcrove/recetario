import { CreateRecipeSchema } from '@recetario/shared'
import type { Category, Recipe, RecipeDifficulty, Unit } from '@recetario/shared'

export interface RecipeTimes {
  prepTimeMin: string
  cookTimeMin: string
  difficulty: RecipeDifficulty | null
}

/** Parses a form-string minute value; returns undefined unless a positive int. */
function parsePositiveInt(value?: string): number | undefined {
  if (!value) return undefined
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export interface IngredientRow {
  name: string
  quantity: string
  unit: string
  presentation: string
}

export interface StepRow {
  text: string
}

export interface FieldErrors {
  title?: string
  servings?: string
  category?: string
  ingredients?: string
  steps?: string
  general?: string
}

export function buildPayload(
  title: string,
  servings: string,
  category: Category,
  tags: string,
  notes: string,
  ingredients: IngredientRow[],
  steps: StepRow[],
  dietaryTags?: string[],
  foodTypeIds?: string[],
  times?: RecipeTimes,
) {
  // When the form supplies times, emit ALL time/difficulty fields as explicit
  // `number | null` so an edit can CLEAR a previously-set value (null) and
  // totalTimeMin can never desync from prep/cook. When `times` is absent, the
  // fields are omitted entirely (leave-unchanged semantics). See CreateRecipeSchema.
  const timeFields = (() => {
    if (!times) return {}
    const prep = parsePositiveInt(times.prepTimeMin) ?? null
    const cook = parsePositiveInt(times.cookTimeMin) ?? null
    const total = prep !== null || cook !== null ? (prep ?? 0) + (cook ?? 0) : null
    return {
      prepTimeMin: prep,
      cookTimeMin: cook,
      totalTimeMin: total,
      difficulty: times.difficulty ?? null,
    }
  })()
  return {
    title: title.trim(),
    servings: parseInt(servings, 10) || 0,
    category,
    tags: tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    notes: notes.trim() || undefined,
    dietaryTags: dietaryTags && dietaryTags.length > 0 ? dietaryTags : undefined,
    foodTypeIds: foodTypeIds && foodTypeIds.length > 0 ? foodTypeIds : undefined,
    ...timeFields,
    ingredients: ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity ? parseFloat(i.quantity) : null,
        unit: (i.unit as Unit) || null,
        presentation: i.presentation.trim() || undefined,
      })),
    steps: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim() })),
  }
}

export function validatePayload(payload: ReturnType<typeof buildPayload>): {
  valid: boolean
  errors: FieldErrors
} {
  const result = CreateRecipeSchema.safeParse(payload)
  if (result.success) return { valid: true, errors: {} }

  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const path = issue.path[0]
    if (path === 'title') errors.title = issue.message
    else if (path === 'servings') errors.servings = issue.message
    else if (path === 'category') errors.category = issue.message
    else if (path === 'ingredients') errors.ingredients = issue.message
    else errors.general = issue.message
  }
  return { valid: false, errors }
}

export function recipeToFormState(recipe: Recipe): {
  title: string
  servings: string
  category: Category
  tags: string
  notes: string
  ingredients: IngredientRow[]
  steps: StepRow[]
  prepTimeMin: string
  cookTimeMin: string
  difficulty: RecipeDifficulty | null
} {
  return {
    title: recipe.title,
    servings: String(recipe.servings),
    category: recipe.category,
    tags: recipe.tags.join(', '),
    notes: recipe.notes ?? '',
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity != null ? String(ing.quantity) : '',
      unit: ing.unit ?? '',
      presentation: ing.presentation ?? '',
    })),
    steps: recipe.steps.map((s) => ({ text: s.text })),
    prepTimeMin: recipe.prepTimeMin != null ? String(recipe.prepTimeMin) : '',
    cookTimeMin: recipe.cookTimeMin != null ? String(recipe.cookTimeMin) : '',
    difficulty: recipe.difficulty ?? null,
  }
}
