import { CreateRecipeSchema, SYSTEM_CATEGORIES } from '@recetario/shared'
import type { Category, Recipe, RecipeDifficulty, Unit } from '@recetario/shared'

const VULGAR_FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
}

/**
 * A typed quantity as a number: "1,5" (the decimal comma used here), "1.5",
 * "1/2", "1 1/2", "½" or "1½". Blank is null ("a gusto"); anything else is NaN
 * so validation rejects it instead of storing a wrong amount — parseFloat
 * read "1,5" and "1/2" as 1.
 */
export function parseQuantity(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!t) return null
  const vulgar = /^(\d+)?\s*([½⅓⅔¼¾])$/.exec(t)
  if (vulgar) return Number(vulgar[1] ?? 0) + VULGAR_FRACTIONS[vulgar[2]!]!
  const mixed = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(t)
  if (mixed) return Number(mixed[1] ?? 0) + Number(mixed[2]) / Number(mixed[3])
  return /^\d*\.?\d+$/.test(t) ? Number(t) : NaN
}

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
    // An empty list is sent as [] so an edit can clear the last tag/type;
    // only an absent list means "leave unchanged".
    dietaryTags,
    foodTypeIds,
    ...timeFields,
    ingredients: ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: parseQuantity(i.quantity),
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
    else if (path === 'ingredients' && issue.path[2] === 'quantity')
      errors.ingredients = `Revisá la cantidad del ingrediente ${Number(issue.path[1]) + 1}: usá un número como 2, 1,5 o 1/2.`
    else if (path === 'ingredients') errors.ingredients = issue.message
    else errors.general = issue.message
  }
  return { valid: false, errors }
}

export interface RecipeFormState {
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
  foodTypeIds: string[]
  dietaryTags: string[]
  visibility: 'private' | 'public'
}

export function recipeToFormState(recipe: Recipe): RecipeFormState {
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
    foodTypeIds: recipe.foodTypeIds ?? [],
    dietaryTags: recipe.dietaryTags ?? [],
    visibility: recipe.visibility ?? 'private',
  }
}

/**
 * Category chips for the recipe form: the system categories in their usual
 * order, then the account's own (from the configurator); just the system ones
 * until those load. The recipe's current category is always offered.
 */
export function categoryOptions(
  loaded: { name: string; isSystem?: boolean }[] | undefined,
  current: string,
): string[] {
  const own = (loaded ?? []).filter((c) => !c.isSystem).map((c) => c.name)
  const options = [...SYSTEM_CATEGORIES, ...own]
  return options.includes(current) ? options : [...options, current]
}
