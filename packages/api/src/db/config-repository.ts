import { and, eq, isNull, ne, or, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { ConfigType, TaxonomyItem } from '@recetario/shared'
import { schema } from './index.js'
import { currentDb, inTransaction } from './transaction.js'

/** Why a delete didn't happen: the item isn't the caller's (or is a system one), or the reassign target isn't usable. */
export type DeleteOutcome = 'deleted' | 'not_found' | 'bad_target'

/** "Comida Rápida" → "comida-rpida": lowercase, dashes, ASCII only. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/** System rows (no owner) plus the caller's own. */
const systemOrOwn = (ownerColumn: AnyPgColumn, ownerId: string) =>
  or(eq(ownerColumn, ownerId), isNull(ownerColumn))

const ownCustomFoodType = (ownerId: string, id: string) =>
  and(
    eq(schema.foodTypes.id, id),
    eq(schema.foodTypes.ownerId, ownerId),
    ne(schema.foodTypes.isSystem, 1),
  )

const ownCustomCategory = (ownerId: string, id: string) =>
  and(
    eq(schema.mealCategories.id, id),
    eq(schema.mealCategories.ownerId, ownerId),
    ne(schema.mealCategories.isSystem, 1),
  )

/**
 * The taxonomy configurator: usage overview, rename, delete with reassignment
 * and tag merge. Every count and every write is limited to the caller's own
 * recipes (2026-10-01 audit: category reassignment used to rewrite every
 * user's recipes, and usage counts included other users' recipes).
 */
export const configRepository = {
  async overview(ownerId: string): Promise<{
    mealCategories: TaxonomyItem[]
    foodTypes: TaxonomyItem[]
    tags: TaxonomyItem[]
  }> {
    const db = currentDb()
    const mealCategories = await db
      .select({
        id: schema.mealCategories.id,
        name: schema.mealCategories.name,
        slug: schema.mealCategories.slug,
        isSystem: schema.mealCategories.isSystem,
        usageCount: sql<number>`cast(count(${schema.recipes.id}) as int)`,
      })
      .from(schema.mealCategories)
      .leftJoin(
        schema.recipes,
        and(
          sql`lower(${schema.recipes.category}) = ${schema.mealCategories.slug}`,
          eq(schema.recipes.ownerId, ownerId),
        ),
      )
      .where(systemOrOwn(schema.mealCategories.ownerId, ownerId))
      .groupBy(schema.mealCategories.id)
      .orderBy(schema.mealCategories.name)

    const foodTypes = await db
      .select({
        id: schema.foodTypes.id,
        name: schema.foodTypes.name,
        slug: schema.foodTypes.slug,
        isSystem: schema.foodTypes.isSystem,
        usageCount: sql<number>`cast(count(${schema.recipes.id}) as int)`,
      })
      .from(schema.foodTypes)
      .leftJoin(schema.recipeFoodTypes, eq(schema.recipeFoodTypes.foodTypeId, schema.foodTypes.id))
      .leftJoin(
        schema.recipes,
        and(
          eq(schema.recipes.id, schema.recipeFoodTypes.recipeId),
          eq(schema.recipes.ownerId, ownerId),
        ),
      )
      .where(systemOrOwn(schema.foodTypes.ownerId, ownerId))
      .groupBy(schema.foodTypes.id)
      .orderBy(schema.foodTypes.name)

    const tags = await db
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        slug: schema.tags.slug,
        usageCount: sql<number>`cast(count(${schema.recipeTags.recipeId}) as int)`,
      })
      .from(schema.tags)
      .leftJoin(schema.recipeTags, eq(schema.recipeTags.tagId, schema.tags.id))
      .where(eq(schema.tags.ownerId, ownerId))
      .groupBy(schema.tags.id)
      .orderBy(schema.tags.name)

    const withSystem = (r: { isSystem: number; usageCount: number }) => ({
      isDeletable: r.usageCount === 0 && r.isSystem !== 1,
      isSystem: r.isSystem === 1,
    })
    return {
      mealCategories: mealCategories.map(({ isSystem, ...r }) => ({
        ...r,
        ...withSystem({ isSystem, usageCount: r.usageCount }),
      })),
      foodTypes: foodTypes.map(({ isSystem, ...r }) => ({
        ...r,
        ...withSystem({ isSystem, usageCount: r.usageCount }),
      })),
      tags: tags.map((r) => ({ ...r, isDeletable: r.usageCount === 0 })),
    }
  },

  /** Renames the caller's own item; null when it isn't theirs. */
  async rename(
    type: ConfigType,
    ownerId: string,
    id: string,
    name: string,
  ): Promise<{ id: string; name: string } | null> {
    const db = currentDb()
    const values = { name, slug: slugify(name) }
    const [row] =
      type === 'categories'
        ? await db
            .update(schema.mealCategories)
            .set(values)
            .where(
              and(eq(schema.mealCategories.id, id), eq(schema.mealCategories.ownerId, ownerId)),
            )
            .returning({ id: schema.mealCategories.id, name: schema.mealCategories.name })
        : type === 'food-types'
          ? await db
              .update(schema.foodTypes)
              .set(values)
              .where(and(eq(schema.foodTypes.id, id), eq(schema.foodTypes.ownerId, ownerId)))
              .returning({ id: schema.foodTypes.id, name: schema.foodTypes.name })
          : await db
              .update(schema.tags)
              .set(values)
              .where(and(eq(schema.tags.id, id), eq(schema.tags.ownerId, ownerId)))
              .returning({ id: schema.tags.id, name: schema.tags.name })
    return row ?? null
  },

  /**
   * Deletes a custom food type; its recipe links move to `reassignTo` (a system
   * or own food type) or are dropped. Links cascade on delete.
   */
  async deleteFoodType(ownerId: string, id: string, reassignTo?: string): Promise<DeleteOutcome> {
    return inTransaction(async () => {
      const db = currentDb()
      const [owned] = await db
        .select({ id: schema.foodTypes.id })
        .from(schema.foodTypes)
        .where(ownCustomFoodType(ownerId, id))
        .limit(1)
      if (!owned) return 'not_found'
      if (reassignTo) {
        const [target] = await db
          .select({ id: schema.foodTypes.id })
          .from(schema.foodTypes)
          .where(
            and(
              eq(schema.foodTypes.id, reassignTo),
              systemOrOwn(schema.foodTypes.ownerId, ownerId),
            ),
          )
          .limit(1)
        if (!target || target.id === id) return 'bad_target'
        const links = await db
          .select({ recipeId: schema.recipeFoodTypes.recipeId })
          .from(schema.recipeFoodTypes)
          .where(eq(schema.recipeFoodTypes.foodTypeId, id))
        if (links.length > 0) {
          await db
            .insert(schema.recipeFoodTypes)
            .values(links.map((l) => ({ recipeId: l.recipeId, foodTypeId: reassignTo })))
            .onConflictDoNothing()
        }
      }
      await db.delete(schema.foodTypes).where(eq(schema.foodTypes.id, id))
      return 'deleted'
    })
  },

  /** Deletes the caller's tag; its recipes move to `reassignTo` (another own tag) or lose it. */
  async deleteTag(ownerId: string, id: string, reassignTo?: string): Promise<DeleteOutcome> {
    return inTransaction(async () => {
      const db = currentDb()
      const owned = await db
        .select({ id: schema.tags.id })
        .from(schema.tags)
        .where(
          and(
            eq(schema.tags.ownerId, ownerId),
            reassignTo
              ? or(eq(schema.tags.id, id), eq(schema.tags.id, reassignTo))
              : eq(schema.tags.id, id),
          ),
        )
      if (!owned.some((t) => t.id === id)) return 'not_found'
      if (reassignTo) {
        if (reassignTo === id || owned.length < 2) return 'bad_target'
        await moveTagLinks(id, reassignTo)
      }
      await db.delete(schema.tags).where(eq(schema.tags.id, id))
      return 'deleted'
    })
  },

  /**
   * Deletes a custom category. Recipes reference categories by name, not by
   * key, so reassigning renames the category on the caller's recipes only.
   */
  async deleteCategory(ownerId: string, id: string, reassignTo?: string): Promise<DeleteOutcome> {
    return inTransaction(async () => {
      const db = currentDb()
      const [owned] = await db
        .select({ slug: schema.mealCategories.slug })
        .from(schema.mealCategories)
        .where(ownCustomCategory(ownerId, id))
        .limit(1)
      if (!owned) return 'not_found'
      if (reassignTo) {
        const [target] = await db
          .select({ id: schema.mealCategories.id, name: schema.mealCategories.name })
          .from(schema.mealCategories)
          .where(
            and(
              eq(schema.mealCategories.id, reassignTo),
              systemOrOwn(schema.mealCategories.ownerId, ownerId),
            ),
          )
          .limit(1)
        if (!target || target.id === id) return 'bad_target'
        await db
          .update(schema.recipes)
          .set({ category: target.name })
          .where(
            and(
              sql`lower(${schema.recipes.category}) = ${owned.slug}`,
              eq(schema.recipes.ownerId, ownerId),
            ),
          )
      }
      await db.delete(schema.mealCategories).where(eq(schema.mealCategories.id, id))
      return 'deleted'
    })
  },

  /**
   * Creates the caller's own item. 'duplicate' when the slug is already taken
   * by a visible item (a system category or food type, or one of their own);
   * 'invalid' when the name has no usable characters for a slug.
   */
  async create(
    type: ConfigType,
    ownerId: string,
    name: string,
  ): Promise<TaxonomyItem | 'duplicate' | 'invalid'> {
    const slug = slugify(name.trim())
    if (!slug.replace(/-/g, '')) return 'invalid'
    const db = currentDb()
    const table =
      type === 'categories'
        ? schema.mealCategories
        : type === 'food-types'
          ? schema.foodTypes
          : schema.tags
    const visible =
      type === 'tags' ? eq(schema.tags.ownerId, ownerId) : systemOrOwn(table.ownerId, ownerId)
    const [taken] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.slug, slug), visible))
      .limit(1)
    if (taken) return 'duplicate'
    const clean = name.trim()
    const [row] =
      type === 'categories'
        ? await db
            .insert(schema.mealCategories)
            .values({ name: clean, slug, ownerId, isSystem: 0 })
            .returning({ id: table.id, name: table.name, slug: table.slug })
        : type === 'food-types'
          ? await db
              .insert(schema.foodTypes)
              .values({ name: clean, slug, ownerId, isSystem: 0 })
              .returning({ id: table.id, name: table.name, slug: table.slug })
          : await db
              .insert(schema.tags)
              .values({ name: clean, slug, ownerId })
              .returning({ id: table.id, name: table.name, slug: table.slug })
    return {
      id: row!.id,
      name: row!.name,
      slug: row!.slug,
      usageCount: 0,
      isDeletable: true,
      ...(type === 'tags' ? {} : { isSystem: false }),
    }
  },

  /**
   * The caller's recipes that use an item, matched exactly like `overview`
   * counts them, so the list behind a badge always has as many rows as the
   * badge says. Null when the item isn't visible to the caller.
   */
  async usedBy(
    type: ConfigType,
    ownerId: string,
    id: string,
  ): Promise<{ id: string; title: string }[] | null> {
    const db = currentDb()
    const recipe = { id: schema.recipes.id, title: schema.recipes.title }
    const own = eq(schema.recipes.ownerId, ownerId)
    if (type === 'categories') {
      const [cat] = await db
        .select({ slug: schema.mealCategories.slug })
        .from(schema.mealCategories)
        .where(
          and(
            eq(schema.mealCategories.id, id),
            systemOrOwn(schema.mealCategories.ownerId, ownerId),
          ),
        )
        .limit(1)
      if (!cat) return null
      return db
        .select(recipe)
        .from(schema.recipes)
        .where(and(own, sql`lower(${schema.recipes.category}) = ${cat.slug}`))
        .orderBy(schema.recipes.title)
    }
    if (type === 'food-types') {
      const [ft] = await db
        .select({ id: schema.foodTypes.id })
        .from(schema.foodTypes)
        .where(and(eq(schema.foodTypes.id, id), systemOrOwn(schema.foodTypes.ownerId, ownerId)))
        .limit(1)
      if (!ft) return null
      return db
        .select(recipe)
        .from(schema.recipes)
        .innerJoin(schema.recipeFoodTypes, eq(schema.recipeFoodTypes.recipeId, schema.recipes.id))
        .where(and(own, eq(schema.recipeFoodTypes.foodTypeId, id)))
        .orderBy(schema.recipes.title)
    }
    const [tag] = await db
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(and(eq(schema.tags.id, id), eq(schema.tags.ownerId, ownerId)))
      .limit(1)
    if (!tag) return null
    return db
      .select(recipe)
      .from(schema.recipes)
      .innerJoin(schema.recipeTags, eq(schema.recipeTags.recipeId, schema.recipes.id))
      .where(eq(schema.recipeTags.tagId, id))
      .orderBy(schema.recipes.title)
  },

  /** Moves every recipe from `sourceId` to `targetId` and deletes the source; null unless both are the caller's. */
  async mergeTags(ownerId: string, sourceId: string, targetId: string): Promise<number | null> {
    return inTransaction(async () => {
      const db = currentDb()
      const owned = await db
        .select({ id: schema.tags.id })
        .from(schema.tags)
        .where(
          and(
            eq(schema.tags.ownerId, ownerId),
            or(eq(schema.tags.id, sourceId), eq(schema.tags.id, targetId)),
          ),
        )
      if (owned.length < 2) return null
      const merged = await moveTagLinks(sourceId, targetId)
      await db.delete(schema.tags).where(eq(schema.tags.id, sourceId))
      return merged
    })
  },
}

/** Copies a tag's recipe links to another tag (skipping duplicates); returns how many recipes had it. */
async function moveTagLinks(fromId: string, toId: string): Promise<number> {
  const db = currentDb()
  const links = await db
    .select({ recipeId: schema.recipeTags.recipeId })
    .from(schema.recipeTags)
    .where(eq(schema.recipeTags.tagId, fromId))
  if (links.length > 0) {
    await db
      .insert(schema.recipeTags)
      .values(links.map((l) => ({ recipeId: l.recipeId, tagId: toId })))
      .onConflictDoNothing()
  }
  return links.length
}
