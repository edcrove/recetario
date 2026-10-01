import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { schema } from './index.js'
import { currentDb } from './transaction.js'

export type RelationType = 'similar' | 'variation' | 'inspiration'

export interface FoodTypeView {
  id: string
  name: string
  slug: string
  isSystem: boolean
}

export interface CollectionView {
  id: string
  name: string
  emoji: string | null
  description: string | null
  recipeCount: number
  createdAt: string
}

export interface RelationView {
  fromId: string
  toId: string
  relationType: RelationType
  createdBy: string
}

/** "Comida Rápida" → "comida-rpida": lowercase, dashes, ASCII only. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

const ownCollection = (ownerId: string, id: string) =>
  and(eq(schema.collections.id, id), eq(schema.collections.ownerId, ownerId))

/**
 * Food types, collections and recipe relations. Routes go through here instead
 * of querying the tables directly (2026-10-01 audit, Clean code).
 */
export const taxonomyRepository = {
  /** System food types plus the caller's own, by name. */
  async listFoodTypes(ownerId: string): Promise<FoodTypeView[]> {
    const rows = await currentDb()
      .select()
      .from(schema.foodTypes)
      .where(or(eq(schema.foodTypes.ownerId, ownerId), isNull(schema.foodTypes.ownerId)))
      .orderBy(schema.foodTypes.name)
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      isSystem: Boolean(r.isSystem),
    }))
  },

  async createFoodType(ownerId: string, name: string): Promise<FoodTypeView> {
    const [row] = await currentDb()
      .insert(schema.foodTypes)
      .values({ name, slug: slugify(name), ownerId, isSystem: 0 })
      .returning()
    return { id: row!.id, name: row!.name, slug: row!.slug, isSystem: false }
  },

  /** The caller's collections with their recipe counts, by name. */
  async listCollections(ownerId: string): Promise<CollectionView[]> {
    const rows = await currentDb()
      .select({
        id: schema.collections.id,
        name: schema.collections.name,
        emoji: schema.collections.emoji,
        description: schema.collections.description,
        recipeCount: sql<number>`cast(count(${schema.recipeCollections.recipeId}) as int)`,
        createdAt: schema.collections.createdAt,
      })
      .from(schema.collections)
      .leftJoin(
        schema.recipeCollections,
        eq(schema.recipeCollections.collectionId, schema.collections.id),
      )
      .where(eq(schema.collections.ownerId, ownerId))
      .groupBy(schema.collections.id)
      .orderBy(schema.collections.name)
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  },

  async createCollection(
    ownerId: string,
    input: { name: string; emoji?: string; description?: string },
  ): Promise<CollectionView> {
    const [row] = await currentDb()
      .insert(schema.collections)
      .values({ ...input, ownerId })
      .returning()
    return {
      id: row!.id,
      name: row!.name,
      emoji: row!.emoji,
      description: row!.description,
      recipeCount: 0,
      createdAt: row!.createdAt.toISOString(),
    }
  },

  /** True when the collection exists and belongs to the caller. */
  async ownsCollection(ownerId: string, id: string): Promise<boolean> {
    const [row] = await currentDb()
      .select({ id: schema.collections.id })
      .from(schema.collections)
      .where(ownCollection(ownerId, id))
      .limit(1)
    return row !== undefined
  },

  /** Deletes the caller's collection and its links (never the recipes); false if not theirs. */
  async deleteCollection(ownerId: string, id: string): Promise<boolean> {
    const deleted = await currentDb()
      .delete(schema.collections)
      .where(ownCollection(ownerId, id))
      .returning({ id: schema.collections.id })
    return deleted.length > 0
  },

  async addRecipeToCollection(collectionId: string, recipeId: string): Promise<void> {
    await currentDb()
      .insert(schema.recipeCollections)
      .values({ collectionId, recipeId })
      .onConflictDoNothing()
  },

  async removeRecipeFromCollection(collectionId: string, recipeId: string): Promise<void> {
    await currentDb()
      .delete(schema.recipeCollections)
      .where(
        and(
          eq(schema.recipeCollections.collectionId, collectionId),
          eq(schema.recipeCollections.recipeId, recipeId),
        ),
      )
  },

  async collectionRecipeIds(collectionId: string): Promise<string[]> {
    const links = await currentDb()
      .select({ recipeId: schema.recipeCollections.recipeId })
      .from(schema.recipeCollections)
      .where(eq(schema.recipeCollections.collectionId, collectionId))
    return links.map((link) => link.recipeId)
  },

  async addRelation(relation: RelationView): Promise<void> {
    await currentDb().insert(schema.recipeRelations).values(relation).onConflictDoNothing()
  },

  async listRelations(fromId: string): Promise<RelationView[]> {
    const rows = await currentDb()
      .select()
      .from(schema.recipeRelations)
      .where(eq(schema.recipeRelations.fromId, fromId))
    return rows.map((r) => ({
      fromId: r.fromId,
      toId: r.toId,
      relationType: r.relationType as RelationType,
      createdBy: r.createdBy,
    }))
  },
}
