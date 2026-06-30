import { DEMO_RECIPES } from '@recetario/shared'
import { RecipeRepository } from '../db/repository.js'

const DEMO_OWNER_ID = 'demo'

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
  seedRecipes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err)
      process.exit(1)
    })
}
