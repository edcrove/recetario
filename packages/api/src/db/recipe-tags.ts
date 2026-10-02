import { and, eq, inArray, sql } from 'drizzle-orm'
import { schema } from './index.js'
import { currentDb } from './transaction.js'
import { replaceTag, tagEntries } from './slug.js'

/**
 * A recipe's `tags` list is what people and agents read and search; the `tags`
 * table is each owner's tag registry (the configurator), linked through
 * `recipe_tags`. These helpers keep both in step (D-2026-10-02-1).
 */

/** Links a recipe to its owner's registry, creating the tags it doesn't have yet. */
export async function syncRecipeTags(
  ownerId: string,
  recipeId: string,
  names: string[],
): Promise<void> {
  const db = currentDb()
  await db.delete(schema.recipeTags).where(eq(schema.recipeTags.recipeId, recipeId))
  const entries = tagEntries(names)
  if (entries.length === 0) return
  await db
    .insert(schema.tags)
    .values(entries.map((e) => ({ ownerId, name: e.name, slug: e.slug })))
    .onConflictDoNothing()
  const rows = await db
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .where(
      and(
        eq(schema.tags.ownerId, ownerId),
        inArray(
          schema.tags.slug,
          entries.map((e) => e.slug),
        ),
      ),
    )
  await db
    .insert(schema.recipeTags)
    .values(rows.map((r) => ({ recipeId, tagId: r.id })))
    .onConflictDoNothing()
}

/** Ids of the recipes linked to a tag. */
export async function recipesWithTag(tagId: string): Promise<string[]> {
  const rows = await currentDb()
    .select({ recipeId: schema.recipeTags.recipeId })
    .from(schema.recipeTags)
    .where(eq(schema.recipeTags.tagId, tagId))
  return rows.map((r) => r.recipeId)
}

/** Applies `replaceTag` to the `tags` list of each recipe. */
export async function rewriteTagOnRecipes(
  recipeIds: string[],
  fromSlug: string,
  toName: string | null,
): Promise<void> {
  const db = currentDb()
  const rows = await db
    .select({ id: schema.recipes.id, tags: schema.recipes.tags })
    .from(schema.recipes)
    .where(inArray(schema.recipes.id, recipeIds))
  for (const row of rows) {
    await db
      .update(schema.recipes)
      .set({ tags: replaceTag(row.tags as string[], fromSlug, toName) })
      .where(eq(schema.recipes.id, row.id))
  }
}

/**
 * One-off backfill for recipes saved before tags were linked: links every
 * recipe that has tags but no `recipe_tags` row. Idempotent; a no-op once done.
 */
export async function backfillRecipeTags(): Promise<number> {
  const rows = await currentDb()
    .select({
      id: schema.recipes.id,
      ownerId: schema.recipes.ownerId,
      tags: schema.recipes.tags,
    })
    .from(schema.recipes)
    .where(
      and(
        sql`jsonb_array_length(${schema.recipes.tags}) > 0`,
        sql`not exists (select 1 from ${schema.recipeTags} where ${schema.recipeTags.recipeId} = ${schema.recipes.id})`,
      ),
    )
  for (const row of rows) await syncRecipeTags(row.ownerId, row.id, row.tags as string[])
  return rows.length
}
