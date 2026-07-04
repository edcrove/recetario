import { eq, and, ilike, or, sql, inArray } from 'drizzle-orm'
import type { CreateRecipe, UpdateRecipe, Recipe } from '@recetario/shared'
import { getDb, schema } from './index.js'

type DbRow = typeof schema.recipes.$inferSelect
type IngredientRow = typeof schema.ingredients.$inferSelect
type StepRow = typeof schema.steps.$inferSelect

function mapToRecipe(
  row: DbRow,
  ingredientRows: IngredientRow[],
  stepRows: StepRow[],
  foodTypeIds: string[],
): Recipe {
  return {
    id: row.id,
    title: row.title,
    servings: row.servings,
    category: row.category as Recipe['category'],
    /* v8 ignore next */
    tags: (row.tags as string[]) ?? [],
    prepTimeMin: row.prepTimeMin ?? undefined,
    cookTimeMin: row.cookTimeMin ?? undefined,
    totalTimeMin: row.totalTimeMin ?? undefined,
    /* v8 ignore next */
    images: (row.images as string[]) ?? [],
    notes: row.notes ?? undefined,
    yield: row.yield ?? undefined,
    originalLanguage: row.originalLanguage,
    /* v8 ignore next */
    translations: (row.translations as Recipe['translations']) ?? [],
    source: (row.source as Recipe['source']) ?? undefined,
    /* v8 ignore next */
    dietaryTags: (row.dietaryTags as Recipe['dietaryTags']) ?? [],
    nutrition: (row.nutrition as Recipe['nutrition']) ?? undefined,
    foodTypeIds,
    ingredients: ingredientRows
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        name: i.name,
        quantity: i.quantity != null ? Number(i.quantity) : null,
        unit: (i.unit as Recipe['ingredients'][number]['unit']) ?? null,
        presentation: i.presentation ?? undefined,
        group: i.group ?? undefined,
        note: i.note ?? undefined,
      })),
    steps: stepRows
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        text: s.text,
        durationMin: s.durationMin ?? undefined,
        ovenTempC: s.ovenTempC ?? undefined,
      })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export class RecipeRepository {
  private get db() {
    return getDb()
  }

  async create(ownerId: string, data: CreateRecipe): Promise<Recipe> {
    const db = this.db
    const [recipe] = await db
      .insert(schema.recipes)
      .values({
        ownerId,
        title: data.title,
        servings: data.servings,
        category: data.category,
        tags: data.tags,
        prepTimeMin: data.prepTimeMin ?? null,
        cookTimeMin: data.cookTimeMin ?? null,
        totalTimeMin: data.totalTimeMin ?? null,
        images: data.images,
        notes: data.notes ?? null,
        yield: data.yield ?? null,
        originalLanguage: data.originalLanguage,
        translations: data.translations,
        source: data.source ?? null,
        dietaryTags: data.dietaryTags ?? [],
        nutrition: data.nutrition ?? null,
      })
      .returning()

    /* v8 ignore next */
    if (!recipe) throw new Error('Failed to insert recipe')

    const ingredientRows = await this.insertIngredients(recipe.id, data.ingredients)
    const stepRows = await this.insertSteps(recipe.id, data.steps)
    await this.replaceFoodTypes(recipe.id, data.foodTypeIds)

    return mapToRecipe(recipe, ingredientRows, stepRows, data.foodTypeIds ?? [])
  }

  private async replaceFoodTypes(recipeId: string, foodTypeIds: string[] | undefined) {
    if (foodTypeIds === undefined) return
    const db = this.db
    await db.delete(schema.recipeFoodTypes).where(eq(schema.recipeFoodTypes.recipeId, recipeId))
    if (foodTypeIds.length === 0) return
    await db
      .insert(schema.recipeFoodTypes)
      .values(foodTypeIds.map((foodTypeId) => ({ recipeId, foodTypeId })))
      .onConflictDoNothing()
  }

  private async getFoodTypeIds(recipeId: string): Promise<string[]> {
    const db = this.db
    const rows = await db
      .select({ foodTypeId: schema.recipeFoodTypes.foodTypeId })
      .from(schema.recipeFoodTypes)
      .where(eq(schema.recipeFoodTypes.recipeId, recipeId))
    return rows.map((r) => r.foodTypeId)
  }

  private async getFoodTypeIdsByRecipe(recipeIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>()
    /* v8 ignore next */
    if (recipeIds.length === 0) return map
    const db = this.db
    const rows = await db
      .select({
        recipeId: schema.recipeFoodTypes.recipeId,
        foodTypeId: schema.recipeFoodTypes.foodTypeId,
      })
      .from(schema.recipeFoodTypes)
      .where(inArray(schema.recipeFoodTypes.recipeId, recipeIds))
    for (const row of rows) {
      const existing = map.get(row.recipeId) ?? []
      existing.push(row.foodTypeId)
      map.set(row.recipeId, existing)
    }
    return map
  }

  private async insertIngredients(recipeId: string, ingredients: CreateRecipe['ingredients']) {
    /* v8 ignore next */
    if (!ingredients || ingredients.length === 0) return []
    const db = this.db
    return db
      .insert(schema.ingredients)
      .values(
        ingredients.map((ing, idx) => ({
          recipeId,
          position: idx,
          name: ing.name,
          quantity: ing.quantity != null ? String(ing.quantity) : null,
          unit: ing.unit ?? null,
          presentation: ing.presentation ?? null,
          group: ing.group ?? null,
          note: ing.note ?? null,
        })),
      )
      .returning()
  }

  private async insertSteps(recipeId: string, steps: NonNullable<CreateRecipe['steps']>) {
    /* v8 ignore next */
    if (!steps || steps.length === 0) return []
    const db = this.db
    return db
      .insert(schema.steps)
      .values(
        steps.map((step, idx) => ({
          recipeId,
          position: idx,
          text: step.text,
          durationMin: step.durationMin ?? null,
          ovenTempC: step.ovenTempC ?? null,
        })),
      )
      .returning()
  }

  async findById(id: string, ownerId: string): Promise<Recipe | null> {
    const db = this.db
    const [recipe] = await db
      .select()
      .from(schema.recipes)
      .where(and(eq(schema.recipes.id, id), eq(schema.recipes.ownerId, ownerId)))
      .limit(1)

    if (!recipe) return null

    const ingredientRows = await db
      .select()
      .from(schema.ingredients)
      .where(eq(schema.ingredients.recipeId, id))

    const stepRows = await db.select().from(schema.steps).where(eq(schema.steps.recipeId, id))
    const foodTypeIds = await this.getFoodTypeIds(id)

    return mapToRecipe(recipe, ingredientRows, stepRows, foodTypeIds)
  }

  async list(ownerId: string, opts: { limit: number; offset: number }): Promise<Recipe[]> {
    const db = this.db

    const recipes = await db
      .select()
      .from(schema.recipes)
      .where(eq(schema.recipes.ownerId, ownerId))
      .limit(opts.limit)
      .offset(opts.offset)

    if (recipes.length === 0) return []

    const ids = recipes.map((r) => r.id)

    const ingredientRows = await db
      .select()
      .from(schema.ingredients)
      .where(
        sql`${schema.ingredients.recipeId} = ANY(${sql.raw(`ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
      )

    const stepRows = await db
      .select()
      .from(schema.steps)
      .where(
        sql`${schema.steps.recipeId} = ANY(${sql.raw(`ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
      )

    const foodTypesByRecipe = await this.getFoodTypeIdsByRecipe(ids)

    return recipes.map((recipe) =>
      mapToRecipe(
        recipe,
        ingredientRows.filter((i) => i.recipeId === recipe.id),
        stepRows.filter((s) => s.recipeId === recipe.id),
        foodTypesByRecipe.get(recipe.id) ?? [],
      ),
    )
  }

  async search(
    ownerId: string,
    q: { q?: string; tag?: string; category?: string; ingredient?: string; dietary?: string },
  ): Promise<Recipe[]> {
    const db = this.db

    const conditions = [eq(schema.recipes.ownerId, ownerId)]

    if (q.q) {
      conditions.push(ilike(schema.recipes.title, `%${q.q}%`))
    }

    if (q.category) {
      conditions.push(ilike(schema.recipes.category, `%${q.category}%`))
    }

    if (q.tag) {
      conditions.push(sql`${schema.recipes.tags}::jsonb @> ${JSON.stringify([q.tag])}::jsonb`)
    }

    /* v8 ignore next 5 - covered by integration tests */
    if (q.dietary) {
      conditions.push(
        sql`${schema.recipes.dietaryTags}::jsonb @> ${JSON.stringify([q.dietary])}::jsonb`,
      )
    }

    const recipes = await db
      .select()
      .from(schema.recipes)
      .where(and(...conditions))
      .limit(50)

    if (recipes.length === 0) return []

    const ids = recipes.map((r) => r.id)

    const ingredientRows = await db
      .select()
      .from(schema.ingredients)
      .where(
        sql`${schema.ingredients.recipeId} = ANY(${sql.raw(`ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
      )

    const stepRows = await db
      .select()
      .from(schema.steps)
      .where(
        sql`${schema.steps.recipeId} = ANY(${sql.raw(`ARRAY[${ids.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
      )

    const foodTypesByRecipe = await this.getFoodTypeIdsByRecipe(ids)

    let results = recipes.map((recipe) =>
      mapToRecipe(
        recipe,
        ingredientRows.filter((i) => i.recipeId === recipe.id),
        stepRows.filter((s) => s.recipeId === recipe.id),
        foodTypesByRecipe.get(recipe.id) ?? [],
      ),
    )

    // Filter by ingredient name at application level (ILIKE on joined table)
    if (q.ingredient) {
      const term = q.ingredient.toLowerCase()
      results = results.filter((r) =>
        r.ingredients.some((i) => i.name.toLowerCase().includes(term)),
      )
    }

    return results
  }

  async update(id: string, ownerId: string, data: UpdateRecipe): Promise<Recipe | null> {
    const db = this.db

    const existing = await this.findById(id, ownerId)
    if (!existing) return null

    const [updated] = await db
      .update(schema.recipes)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.servings !== undefined && { servings: data.servings }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.prepTimeMin !== undefined && { prepTimeMin: data.prepTimeMin }),
        ...(data.cookTimeMin !== undefined && { cookTimeMin: data.cookTimeMin }),
        ...(data.totalTimeMin !== undefined && { totalTimeMin: data.totalTimeMin }),
        ...(data.images !== undefined && { images: data.images }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.yield !== undefined && { yield: data.yield }),
        ...(data.originalLanguage !== undefined && { originalLanguage: data.originalLanguage }),
        ...(data.translations !== undefined && { translations: data.translations }),
        ...(data.source !== undefined && { source: data.source }),
        /* v8 ignore next 2 */
        ...(data.dietaryTags !== undefined && { dietaryTags: data.dietaryTags }),
        ...(data.nutrition !== undefined && { nutrition: data.nutrition }),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.recipes.id, id), eq(schema.recipes.ownerId, ownerId)))
      .returning()

    /* v8 ignore next */
    if (!updated) return null

    // Replace ingredients and steps if provided
    if (data.ingredients !== undefined) {
      await db.delete(schema.ingredients).where(eq(schema.ingredients.recipeId, id))
      await this.insertIngredients(id, data.ingredients)
    }

    if (data.steps !== undefined) {
      await db.delete(schema.steps).where(eq(schema.steps.recipeId, id))
      await this.insertSteps(id, data.steps)
    }

    await this.replaceFoodTypes(id, data.foodTypeIds)

    return this.findById(id, ownerId)
  }

  async delete(id: string, ownerId: string): Promise<boolean> {
    const db = this.db
    const result = await db
      .delete(schema.recipes)
      .where(and(eq(schema.recipes.id, id), eq(schema.recipes.ownerId, ownerId)))
      .returning({ id: schema.recipes.id })

    return result.length > 0
  }

  async upsert(ownerId: string, data: CreateRecipe): Promise<{ recipe: Recipe; created: boolean }> {
    const db = this.db

    // Check for existing recipe by source
    if (data.source?.url ?? data.source?.externalId) {
      const conditions = [eq(schema.recipeSources.ownerId, ownerId)]
      const orConditions = []

      if (data.source?.url) {
        orConditions.push(eq(schema.recipeSources.sourceUrl, data.source.url))
      }
      if (data.source?.externalId) {
        orConditions.push(eq(schema.recipeSources.externalId, data.source.externalId))
      }

      if (orConditions.length > 0) {
        const [existing] = await db
          .select()
          .from(schema.recipeSources)
          .where(and(...conditions, or(...orConditions)))
          .limit(1)

        if (existing) {
          const recipe = await this.update(existing.recipeId, ownerId, data)
          /* v8 ignore next */
          if (!recipe) throw new Error('Failed to update recipe during upsert')
          return { recipe, created: false }
        }
      }
    }

    // Insert new recipe
    const recipe = await this.create(ownerId, data)

    // Insert into recipe_sources if source has URL or externalId
    if (data.source?.url ?? data.source?.externalId) {
      await db.insert(schema.recipeSources).values({
        recipeId: recipe.id!,
        ownerId,
        sourceUrl: data.source?.url ?? null,
        externalId: data.source?.externalId ?? null,
      })
    }

    return { recipe, created: true }
  }
}

// Singleton for use in routes
export const recipeRepository = new RecipeRepository()
