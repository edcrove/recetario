import { eq, desc, sql, and, gte } from 'drizzle-orm'
import { getDb, schema } from './index.js'

export interface CookSessionRow {
  id: string
  recipeId: string
  ownerId: string
  cookedAt: Date
  rating: number | null
  notes: string | null
  createdAt: Date
}

export interface CookStats {
  topRecipes: Array<{ recipeId: string; count: number; lastCookedAt: Date }>
  frequencyByWeek: Array<{ week: string; count: number }>
  totalSessions: number
}

export const cookSessionsRepository = {
  async create(
    ownerId: string,
    recipeId: string,
    rating?: number | null,
    notes?: string | null,
  ): Promise<CookSessionRow> {
    const db = getDb()
    const [session] = await db
      .insert(schema.cookSessions)
      .values({ ownerId, recipeId, rating: rating ?? null, notes: notes ?? null })
      .returning()
    return session!
  },

  async listByRecipe(
    ownerId: string,
    recipeId: string,
    limit = 20,
    offset = 0,
  ): Promise<CookSessionRow[]> {
    const db = getDb()
    return db
      .select()
      .from(schema.cookSessions)
      .where(
        and(eq(schema.cookSessions.ownerId, ownerId), eq(schema.cookSessions.recipeId, recipeId)),
      )
      .orderBy(desc(schema.cookSessions.cookedAt))
      .limit(limit)
      .offset(offset)
  },

  async getStats(ownerId: string, since?: Date): Promise<CookStats> {
    const db = getDb()
    const windowStart = since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days

    // Top recipes by cook count
    const topRecipes = await db
      .select({
        recipeId: schema.cookSessions.recipeId,
        count: sql<number>`cast(count(*) as int)`,
        lastCookedAt: sql<Date>`max(${schema.cookSessions.cookedAt})`,
      })
      .from(schema.cookSessions)
      .where(
        and(
          eq(schema.cookSessions.ownerId, ownerId),
          gte(schema.cookSessions.cookedAt, windowStart),
        ),
      )
      .groupBy(schema.cookSessions.recipeId)
      .orderBy(sql`count(*) desc`)
      .limit(10)

    // Sessions per week
    const frequencyByWeek = await db
      .select({
        week: sql<string>`to_char(date_trunc('week', ${schema.cookSessions.cookedAt}), 'YYYY-MM-DD')`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(schema.cookSessions)
      .where(
        and(
          eq(schema.cookSessions.ownerId, ownerId),
          gte(schema.cookSessions.cookedAt, windowStart),
        ),
      )
      .groupBy(sql`date_trunc('week', ${schema.cookSessions.cookedAt})`)
      .orderBy(sql`date_trunc('week', ${schema.cookSessions.cookedAt}) asc`)

    const [totalRow] = await db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(schema.cookSessions)
      .where(eq(schema.cookSessions.ownerId, ownerId))

    return {
      topRecipes: topRecipes.map((r) => ({
        recipeId: r.recipeId,
        count: r.count,
        lastCookedAt: r.lastCookedAt,
      })),
      frequencyByWeek: frequencyByWeek.map((r) => ({ week: r.week, count: r.count })),
      totalSessions: totalRow?.total ?? 0,
    }
  },
}
