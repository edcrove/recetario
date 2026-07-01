import { CreateRecipeSchema } from '@recetario/shared'
import type { Category, Recipe, Unit } from '@recetario/shared'

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
) {
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
  }
}
