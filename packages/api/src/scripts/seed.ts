import { DEMO_RECIPES } from '@recetario/shared'
import { RecipeRepository } from '../db/repository.js'
import { getDb, schema } from '../db/index.js'
import { seedIngredients } from '../db/seed-ingredients.js'

const DEMO_OWNER_ID = 'demo'

async function seedTaxonomy(): Promise<void> {
  const db = getDb()

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

export async function seedRecipes(ownerId: string = DEMO_OWNER_ID): Promise<void> {
  const repo = new RecipeRepository()

  console.log(`Seeding ${DEMO_RECIPES.length} demo recipes for owner "${ownerId}"...`)

  for (const recipeData of DEMO_RECIPES) {
    const { recipe, created } = await repo.upsert(ownerId, recipeData)
    console.log(`${created ? 'Created' : 'Updated'}: ${recipe.title} (${recipe.id})`)
  }

  console.log('Seed complete.')
}

if (process.env['NODE_ENV'] !== 'test') {
  Promise.all([seedTaxonomy(), seedRecipes()])
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err)
      process.exit(1)
    })
}
