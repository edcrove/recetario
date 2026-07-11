/**
 * Curated es-AR ingredient seed (canonical / synonym / family). Idempotent:
 * safe to run on every boot and after a reset (ON CONFLICT DO NOTHING on the
 * normalized keys). Seeds are isSystem rows — protected from deletion/rename.
 *
 * Modeling rules (see Spec):
 *  - A canonical is the real matching unit; culinarily non-interchangeable cuts
 *    are separate canonicals in the same family (muslo ≠ pata).
 *  - Synonyms are interchangeable surface strings (pechuga → pollo).
 *  - Physical forms are presentations, not ingredients, and are stripped by the
 *    normalizer — so "carne picada"/"queso rallado" need no rows; they resolve
 *    to "carne"/"queso" on their own.
 */
import { normalizeIngredientKey } from '@recetario/shared'
import type { getDb } from './index.js'
import { schema } from './index.js'

type Db = ReturnType<typeof getDb>

export const INGREDIENT_FAMILIES = ['pollo', 'vacuno', 'cerdo', 'pescado'] as const

/** Canonical display names, optionally grouped into a family. */
export const CANONICAL_INGREDIENTS: {
  name: string
  family?: (typeof INGREDIENT_FAMILIES)[number]
}[] = [
  // Aves — pollo family (distinct cuts kept separate)
  { name: 'Pollo', family: 'pollo' },
  { name: 'Muslo de pollo', family: 'pollo' },
  { name: 'Pata de pollo', family: 'pollo' },
  { name: 'Alita de pollo', family: 'pollo' },
  // Vacuno
  { name: 'Carne', family: 'vacuno' },
  { name: 'Bife', family: 'vacuno' },
  { name: 'Nalga', family: 'vacuno' },
  { name: 'Peceto', family: 'vacuno' },
  { name: 'Vacío', family: 'vacuno' },
  { name: 'Asado', family: 'vacuno' },
  { name: 'Osobuco', family: 'vacuno' },
  // Cerdo
  { name: 'Bondiola', family: 'cerdo' },
  { name: 'Panceta', family: 'cerdo' },
  { name: 'Pechito de cerdo', family: 'cerdo' },
  // Pescado
  { name: 'Merluza', family: 'pescado' },
  { name: 'Salmón', family: 'pescado' },
  { name: 'Atún', family: 'pescado' },
  // Verduras
  { name: 'Cebolla' },
  { name: 'Cebolla de verdeo' },
  { name: 'Ajo' },
  { name: 'Puerro' },
  { name: 'Tomate' },
  { name: 'Papa' },
  { name: 'Batata' },
  { name: 'Zanahoria' },
  { name: 'Morrón' },
  { name: 'Zapallo' },
  { name: 'Zapallito' },
  { name: 'Berenjena' },
  { name: 'Lechuga' },
  { name: 'Espinaca' },
  { name: 'Rúcula' },
  { name: 'Brócoli' },
  { name: 'Coliflor' },
  { name: 'Choclo' },
  { name: 'Arveja' },
  { name: 'Chaucha' },
  { name: 'Palta' },
  { name: 'Champiñón' },
  // Frutas
  { name: 'Limón' },
  { name: 'Naranja' },
  { name: 'Manzana' },
  { name: 'Banana' },
  { name: 'Pera' },
  { name: 'Frutilla' },
  { name: 'Durazno' },
  { name: 'Ananá' },
  // Lácteos
  { name: 'Leche' },
  { name: 'Queso' },
  { name: 'Manteca' },
  { name: 'Crema' },
  { name: 'Yogur' },
  { name: 'Ricota' },
  // Almacén
  { name: 'Huevo' },
  { name: 'Harina' },
  { name: 'Arroz' },
  { name: 'Fideos' },
  { name: 'Polenta' },
  { name: 'Lenteja' },
  { name: 'Garbanzo' },
  { name: 'Poroto' },
  { name: 'Aceite' },
  { name: 'Vinagre' },
  { name: 'Sal' },
  { name: 'Azúcar' },
  { name: 'Pan' },
  { name: 'Maní' },
  { name: 'Nuez' },
  { name: 'Almendra' },
  // Bebidas
  { name: 'Vino' },
  { name: 'Cerveza' },
]

/** Interchangeable surface strings → their canonical display name. */
export const INGREDIENT_SYNONYMS: { surface: string; canonical: string }[] = [
  // Pollo
  { surface: 'Suprema de pollo', canonical: 'Pollo' },
  { surface: 'Suprema', canonical: 'Pollo' },
  { surface: 'Pechuga', canonical: 'Pollo' },
  { surface: 'Pechuga de pollo', canonical: 'Pollo' },
  // Vacuno
  { surface: 'Bife de chorizo', canonical: 'Bife' },
  { surface: 'Bife angosto', canonical: 'Bife' },
  { surface: 'Bife ancho', canonical: 'Bife' },
  { surface: 'Bola de lomo', canonical: 'Nalga' },
  // Cebolla
  { surface: 'Cebolla blanca', canonical: 'Cebolla' },
  { surface: 'Cebolla morada', canonical: 'Cebolla' },
  { surface: 'Cebolla colorada', canonical: 'Cebolla' },
  // Tomate
  { surface: 'Tomate perita', canonical: 'Tomate' },
  { surface: 'Tomate redondo', canonical: 'Tomate' },
  { surface: 'Tomate cherry', canonical: 'Tomate' },
  // Morrón
  { surface: 'Ají', canonical: 'Morrón' },
  { surface: 'Pimiento', canonical: 'Morrón' },
  { surface: 'Ají morrón', canonical: 'Morrón' },
  // Papa / batata
  { surface: 'Patata', canonical: 'Papa' },
  { surface: 'Boniato', canonical: 'Batata' },
  // Zapallo
  { surface: 'Calabaza', canonical: 'Zapallo' },
  { surface: 'Auyama', canonical: 'Zapallo' },
  // Choclo
  { surface: 'Maíz', canonical: 'Choclo' },
  { surface: 'Elote', canonical: 'Choclo' },
  // Palta
  { surface: 'Aguacate', canonical: 'Palta' },
  // Arveja / chaucha
  { surface: 'Guisante', canonical: 'Arveja' },
  { surface: 'Judía verde', canonical: 'Chaucha' },
  { surface: 'Poroto verde', canonical: 'Chaucha' },
  // Poroto
  { surface: 'Frijol', canonical: 'Poroto' },
  { surface: 'Alubia', canonical: 'Poroto' },
  { surface: 'Judía', canonical: 'Poroto' },
  // Champiñón
  { surface: 'Hongo', canonical: 'Champiñón' },
  // Frutas
  { surface: 'Fresa', canonical: 'Frutilla' },
  { surface: 'Melocotón', canonical: 'Durazno' },
  { surface: 'Plátano', canonical: 'Banana' },
  { surface: 'Piña', canonical: 'Ananá' },
  // Lácteos
  { surface: 'Mantequilla', canonical: 'Manteca' },
  { surface: 'Nata', canonical: 'Crema' },
  { surface: 'Crema de leche', canonical: 'Crema' },
  // Alérgenos / varios
  { surface: 'Cacahuate', canonical: 'Maní' },
  { surface: 'Cacahuete', canonical: 'Maní' },
]

/**
 * Idempotently seeds the canonical/synonym/family tables. Returns the counts
 * actually inserted (0s on a re-run).
 */
export async function seedIngredients(
  db: Db,
): Promise<{ families: number; canonicals: number; synonyms: number }> {
  // Families
  for (const name of INGREDIENT_FAMILIES) {
    await db
      .insert(schema.ingredientFamilies)
      .values({ name, isSystem: true })
      .onConflictDoNothing()
  }
  const familyRows = await db
    .select({ id: schema.ingredientFamilies.id, name: schema.ingredientFamilies.name })
    .from(schema.ingredientFamilies)
  const familyIdByName = new Map(familyRows.map((f) => [f.name, f.id]))

  // Canonicals
  for (const c of CANONICAL_INGREDIENTS) {
    await db
      .insert(schema.canonicalIngredients)
      .values({
        name: c.name,
        normalizedName: normalizeIngredientKey(c.name),
        // Every family listed in INGREDIENT_FAMILIES was just inserted above.
        familyId: c.family ? familyIdByName.get(c.family)! : null,
        isSystem: true,
      })
      .onConflictDoNothing()
  }
  const canonicalRows = await db
    .select({
      id: schema.canonicalIngredients.id,
      normalizedName: schema.canonicalIngredients.normalizedName,
    })
    .from(schema.canonicalIngredients)
  const canonicalIdByNorm = new Map(canonicalRows.map((c) => [c.normalizedName, c.id]))

  // Synonyms — every s.canonical matches a canonical seeded above (a typo would
  // surface loudly as a not-null FK violation rather than a silent skip).
  for (const s of INGREDIENT_SYNONYMS) {
    const canonicalId = canonicalIdByNorm.get(normalizeIngredientKey(s.canonical))!
    await db
      .insert(schema.ingredientSynonyms)
      .values({ synonym: normalizeIngredientKey(s.surface), canonicalId, isSystem: true })
      .onConflictDoNothing()
  }

  return {
    families: INGREDIENT_FAMILIES.length,
    canonicals: CANONICAL_INGREDIENTS.length,
    synonyms: INGREDIENT_SYNONYMS.length,
  }
}
