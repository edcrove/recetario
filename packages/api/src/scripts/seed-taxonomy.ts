import { getDb, schema } from '../db/index.js'
import { seedIngredients } from '../db/seed-ingredients.js'

type Db = ReturnType<typeof getDb>

/**
 * Production-safe base data: system meal categories, food types and the ingredient
 * catalog. Idempotent (onConflictDoNothing), so the deploy runs it on every start.
 * Demo recipes live in seed.ts and never run in production.
 */
export async function seedTaxonomy(db: Db = getDb()): Promise<void> {
  const categories = [
    { name: 'Desayuno', slug: 'desayuno', isSystem: 1 },
    { name: 'Almuerzo', slug: 'almuerzo', isSystem: 1 },
    { name: 'Cena', slug: 'cena', isSystem: 1 },
    { name: 'Postre', slug: 'postre', isSystem: 1 },
    { name: 'Snack', slug: 'snack', isSystem: 1 },
    { name: 'Bebida', slug: 'bebida', isSystem: 1 },
    { name: 'Otro', slug: 'otro', isSystem: 1 },
  ]
  for (const c of categories) {
    await db.insert(schema.mealCategories).values(c).onConflictDoNothing()
  }

  const foodTypes = [
    { name: 'Guiso', slug: 'guiso', isSystem: 1 },
    { name: 'Sopa', slug: 'sopa', isSystem: 1 },
    { name: 'Carne', slug: 'carne', isSystem: 1 },
    { name: 'Minuta', slug: 'minuta', isSystem: 1 },
    { name: 'Ensalada', slug: 'ensalada', isSystem: 1 },
    { name: 'Pasta', slug: 'pasta', isSystem: 1 },
    { name: 'Postre', slug: 'postre-tipo', isSystem: 1 },
    { name: 'Bebida', slug: 'bebida-tipo', isSystem: 1 },
    { name: 'Saludable', slug: 'saludable', isSystem: 1 },
    { name: 'Panificado', slug: 'panificado', isSystem: 1 },
    { name: 'Tarta / Empanada', slug: 'tarta', isSystem: 1 },
  ]
  for (const ft of foodTypes) {
    await db.insert(schema.foodTypes).values(ft).onConflictDoNothing()
  }

  await seedIngredients(db)
  console.log('Taxonomy + ingredients seeded.')
}
