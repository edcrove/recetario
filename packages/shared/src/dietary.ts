import type { DietaryTag } from './schema.js'
import { ingredientHasAllergen } from './allergen.js'
import { normalizeIngredientKey } from './ingredientCanonical.js'

/** A stricter diet satisfies the looser ones it implies. */
const IMPLIES: Partial<Record<DietaryTag, DietaryTag[]>> = {
  vegano: ['vegetariano', 'sin-lactosa'],
}

/** The tags plus everything they imply (vegano ⇒ vegetariano, sin-lactosa). */
export function expandDietaryTags(tags: readonly string[]): Set<string> {
  const out = new Set<string>(tags)
  for (const t of tags) for (const implied of IMPLIES[t as DietaryTag] ?? []) out.add(implied)
  return out
}

const norm = (s: string) => normalizeIngredientKey(s)

const MEAT_TERMS = [
  'carne',
  'pollo',
  'gallina',
  'pavo',
  'pato',
  'cerdo',
  'chancho',
  'bondiola',
  'jamon',
  'panceta',
  'tocino',
  'chorizo',
  'salchicha',
  'morcilla',
  'longaniza',
  'salame',
  'mortadela',
  'lomo',
  'matambre',
  'vacio',
  'nalga',
  'peceto',
  'bife',
  'costilla',
  'osobuco',
  'entraña',
  'mondongo',
  'higado',
  'molleja',
  'cordero',
  'chivito',
  'conejo',
  'hamburguesa',
  'pechuga',
  'muslo',
  'pata de pollo',
  'caldo de carne',
  'caldo de pollo',
  'gelatina',
].map(norm)

const MEAT_EXCEPT = [
  'carne de soja',
  'carne vegetal',
  'hamburguesa de lenteja',
  'hamburguesa de garbanzo',
  'hamburguesa vegetal',
  'chorizo vegano',
  'gelatina vegetal',
  'gelatina de agar',
].map(norm)

function hasMeat(ingredientName: string): boolean {
  let padded = ` ${norm(ingredientName)} `
  for (const phrase of MEAT_EXCEPT) padded = padded.split(` ${phrase} `).join('  ')
  return MEAT_TERMS.some((t) => padded.includes(` ${t} `))
}

const hasHoney = (name: string) => ` ${norm(name)} `.includes(' miel ')

/**
 * Ingredient checks for the diets that can be decided from ingredient names.
 * keto/paleo depend on amounts and are never auto-checked.
 */
const VIOLATES: Partial<Record<DietaryTag, (ingredientName: string) => boolean>> = {
  vegetariano: (n) =>
    hasMeat(n) ||
    ingredientHasAllergen(n, 'pescado') ||
    ingredientHasAllergen(n, 'crustaceos') ||
    ingredientHasAllergen(n, 'moluscos'),
  vegano: (n) =>
    VIOLATES.vegetariano!(n) ||
    ingredientHasAllergen(n, 'leche') ||
    ingredientHasAllergen(n, 'huevo') ||
    hasHoney(n),
  'sin-gluten': (n) => ingredientHasAllergen(n, 'gluten'),
  'sin-lactosa': (n) => ingredientHasAllergen(n, 'leche'),
}

export interface DietaryConflict {
  tag: DietaryTag
  ingredient: string
}

/**
 * Tags a recipe claims that its own ingredients contradict (a "vegano" recipe
 * with chorizo). Used to reject inconsistent tags at the API.
 */
export function dietaryConflicts(
  ingredients: ReadonlyArray<{ name: string }>,
  tags: readonly string[],
): DietaryConflict[] {
  const conflicts: DietaryConflict[] = []
  for (const tag of tags) {
    const violates = VIOLATES[tag as DietaryTag]
    if (!violates) continue
    for (const ing of ingredients) {
      if (violates(ing.name)) conflicts.push({ tag: tag as DietaryTag, ingredient: ing.name })
    }
  }
  return conflicts
}

export type DietaryStatus = 'cumple' | 'no-cumple' | 'sin-verificar'

/**
 * Whether a recipe fits a diet: 'no-cumple' when an ingredient contradicts it,
 * 'cumple' when the recipe is tagged with it (directly or by implication), and
 * 'sin-verificar' otherwise — a missing tag is unknown, not a violation.
 */
export function dietaryStatus(
  recipe: { ingredients: ReadonlyArray<{ name: string }>; dietaryTags?: readonly string[] | null },
  diet: string,
): DietaryStatus {
  const violates = VIOLATES[diet as DietaryTag]
  if (violates && recipe.ingredients.some((i) => violates(i.name))) return 'no-cumple'
  return expandDietaryTags(recipe.dietaryTags ?? []).has(diet) ? 'cumple' : 'sin-verificar'
}
