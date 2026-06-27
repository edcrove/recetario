import { DEMO_RECIPES } from '@recetario/shared'
import { RecipeRepository } from '../db/repository.js'

const DEMO_OWNER_ID = 'demo'

async function seed() {
  const repo = new RecipeRepository()

  console.log(`Seeding ${DEMO_RECIPES.length} demo recipes for owner "${DEMO_OWNER_ID}"...`)

  for (const recipeData of DEMO_RECIPES) {
    const { recipe, created } = await repo.upsert(DEMO_OWNER_ID, recipeData)
    console.log(`${created ? 'Created' : 'Updated'}: ${recipe.title} (${recipe.id})`)
  }

  console.log('Seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
