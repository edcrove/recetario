import { apiErrorMessage } from './apiError'
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
  /** A stored total with no prep/cook split (seeds, MCP); kept while both stay blank. */
  totalTimeMin?: string
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
    const total =
      prep !== null || cook !== null
        ? (prep ?? 0) + (cook ?? 0)
        : (parsePositiveInt(times.totalTimeMin) ?? null)
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

type Issue = { code: string; path: ReadonlyArray<PropertyKey> }

/** Spanish copy for one validation issue; never the raw (English) Zod message. */
function issueMessage(issue: Issue): { field: keyof FieldErrors; message: string } {
  const [field, index, sub] = issue.path
  const n = typeof index === 'number' ? index + 1 : 0
  const tooBig = issue.code === 'too_big'
  switch (field) {
    case 'title':
      return {
        field: 'title',
        message: tooBig ? 'El título puede tener hasta 200 caracteres.' : 'Poné un título.',
      }
    case 'servings':
      return { field: 'servings', message: 'Las porciones tienen que ser un número mayor que 0.' }
    case 'category':
      return { field: 'category', message: 'Elegí una categoría.' }
    case 'ingredients':
      if (sub === 'quantity')
        return {
          field: 'ingredients',
          message: `Revisá la cantidad del ingrediente ${n}: usá un número como 2, 1,5 o 1/2.`,
        }
      if (n > 0) return { field: 'ingredients', message: `Revisá el ingrediente ${n}.` }
      return {
        field: 'ingredients',
        message: tooBig ? 'Puede tener hasta 200 ingredientes.' : 'Agregá al menos un ingrediente.',
      }
    case 'steps':
      if (n > 0) return { field: 'steps', message: `Revisá el paso ${n}.` }
      if (tooBig) return { field: 'steps', message: 'Puede tener hasta 150 pasos.' }
      return { field: 'general', message: 'Revisá los pasos de la receta.' }
    case 'prepTimeMin':
    case 'cookTimeMin':
    case 'totalTimeMin':
      return { field: 'general', message: 'Los tiempos van en minutos enteros.' }
    default:
      return { field: 'general', message: 'Revisá los datos de la receta.' }
  }
}

const FIELD_NAMES: Partial<Record<keyof FieldErrors, string>> = {
  title: 'título',
  servings: 'porciones',
  category: 'categoría',
  ingredients: 'ingredientes',
  steps: 'pasos',
}

/** "Revisá: título, ingredientes." — shown next to the save button. */
export function errorSummary(errors: FieldErrors): string | undefined {
  const names = (Object.keys(FIELD_NAMES) as Array<keyof FieldErrors>)
    .filter((k) => errors[k])
    .map((k) => FIELD_NAMES[k])
  return names.length > 0 ? `Revisá: ${names.join(', ')}.` : undefined
}

export function validatePayload(payload: ReturnType<typeof buildPayload>): {
  valid: boolean
  errors: FieldErrors
} {
  const result = CreateRecipeSchema.safeParse(payload)
  if (result.success) return { valid: true, errors: {} }

  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    const { field, message } = issueMessage(issue)
    errors[field] ??= message
  }
  return { valid: false, errors }
}

/**
 * The save error from the API in Spanish: 403/404 mean the recipe isn't yours
 * (or is gone), 5xx is the server's fault (its text is English or HTML); 4xx
 * validation keeps the API's own message (diet conflicts are already Spanish).
 */
export function saveErrorMessage(message: string): string {
  const status = /^API (\d+):/.exec(message)?.[1]
  if (status === '404')
    return 'No encontramos esta receta: puede que la hayan borrado o no sea tuya.'
  if (status === '403') return 'No tenés permiso para editar esta receta.'
  if (status && Number(status) >= 500)
    return 'No se pudo guardar la receta por un error del servidor. Probá de nuevo.'
  return apiErrorMessage(message)
}

/**
 * The API's diet-tag conflicts ("Sin gluten: "Fideos" parece no cumplirlo…"),
 * shown right under the diet chips instead of at the bottom of the form.
 */
export function dietTagErrors(message: string | undefined): string | undefined {
  const m = message ? /^API 400: (.*)$/s.exec(message) : null
  if (!m) return undefined
  try {
    const body = JSON.parse(m[1]!) as { details?: Array<{ path?: unknown; message?: string }> }
    const lines = (body.details ?? [])
      .filter((d) => d.path === 'dietaryTags' && d.message)
      .map((d) => d.message!)
    return lines.length > 0 ? lines.join('\n') : undefined
  } catch {
    return undefined
  }
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
  /** Only set for a recipe whose time has no prep/cook split; see RecipeTimes. */
  totalTimeMin: string
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
    totalTimeMin:
      recipe.prepTimeMin == null && recipe.cookTimeMin == null && recipe.totalTimeMin != null
        ? String(recipe.totalTimeMin)
        : '',
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
