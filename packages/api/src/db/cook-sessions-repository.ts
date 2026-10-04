import { eq, desc, sql, and, gte, inArray } from 'drizzle-orm'
import { getDb, schema } from './index.js'
import { getVisibleOwnerIds, UUID_RE } from './household-visibility.js'

export interface CookSessionRow {
  id: string
  recipeId: string | null
  recipeTitle: string | null
  ownerId: string
  cookedAt: Date
  rating: number | null
  notes: string | null
  servings: number | null
  source: string | null
  nutritionSnapshot: unknown
  createdAt: Date
}

export interface CookSessionInput {
  rating?: number | null
  notes?: string | null
  servings?: number
  source?: 'app' | 'mcp'
}

export interface CookStats {
  topRecipes: Array<{
    recipeId: string | null
    title: string | null
    count: number
    lastCookedAt: Date
  }>
  frequencyByWeek: Array<{ week: string; count: number }>
  totalSessions: number
  windowStart: Date
}

export const cookSessionsRepository = {
  async create(
    ownerId: string,
    recipeId: string,
    input: CookSessionInput = {},
  ): Promise<CookSessionRow | null> {
    const db = getDb()
    // Snapshot the recipe's current title — see 2026-07-03 audit finding:
    // deleting the recipe now sets recipeId to null instead of destroying
    // this row, and the snapshot keeps history readable either way.
    // Scope the lookup to visible owners (own OR household) so a POST with
    // someone else's private recipe id can't leak its title (cross-tenant IDOR,
    // same class as the menu upsert fix in #108).
    const visibleOwners = await getVisibleOwnerIds(ownerId)
    const [recipe] = await db
      .select({ title: schema.recipes.title, nutrition: schema.recipes.nutrition })
      .from(schema.recipes)
      .where(and(eq(schema.recipes.id, recipeId), inArray(schema.recipes.ownerId, visibleOwners)))
      .limit(1)
    // A recipe the caller can't see is refused (route → 404), not logged with a
    // null title: those rows polluted per-recipe ratings and told the caller
    // that a private id existed (Auditar 2026-10-03).
    if (!recipe) return null

    const [session] = await db
      .insert(schema.cookSessions)
      .values({
        ownerId,
        recipeId,
        recipeTitle: recipe.title,
        rating: input.rating ?? null,
        notes: input.notes ?? null,
        servings: input.servings ?? null,
        source: input.source ?? null,
        nutritionSnapshot: recipe.nutrition ?? null,
      })
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

  async listRecent(ownerId: string, limit = 20, offset = 0): Promise<CookSessionRow[]> {
    return getDb()
      .select()
      .from(schema.cookSessions)
      .where(eq(schema.cookSessions.ownerId, ownerId))
      .orderBy(desc(schema.cookSessions.cookedAt))
      .limit(limit)
      .offset(offset)
  },

  /**
   * Per-recipe signals for suggestions: the caller's average rating and
   * whether they cooked it on or after `recentSince` (variety).
   */
  async recipeSignals(
    ownerId: string,
    recentSince: Date,
  ): Promise<Map<string, { avgRating: number | null; recentlyCooked: boolean }>> {
    const rows = await getDb()
      .select({
        recipeId: schema.cookSessions.recipeId,
        avgRating: sql<number | null>`avg(${schema.cookSessions.rating})::float`,
        lastCookedAt: sql<Date>`max(${schema.cookSessions.cookedAt})`,
      })
      .from(schema.cookSessions)
      .where(eq(schema.cookSessions.ownerId, ownerId))
      .groupBy(schema.cookSessions.recipeId)
    const map = new Map<string, { avgRating: number | null; recentlyCooked: boolean }>()
    for (const r of rows) {
      if (!r.recipeId) continue // sessions of deleted recipes
      map.set(r.recipeId, {
        avgRating: r.avgRating === null ? null : Math.round(r.avgRating * 10) / 10,
        recentlyCooked: new Date(r.lastCookedAt) >= recentSince,
      })
    }
    return map
  },

  /**
   * The distinct dates this person cooked on, in their profile's time zone (a
   * 23:30 dinner in Montevideo is that day, not the next UTC one), plus that
   * zone's "today". All history, not a window: a streak can be older. Owners
   * without a profile (API keys) use UTC.
   */
  async cookDays(ownerId: string): Promise<{ days: string[]; today: string }> {
    const db = getDb()
    let timeZone = 'UTC'
    if (UUID_RE.test(ownerId)) {
      const [profile] = await db
        .select({ timezone: schema.userProfiles.timezone })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, ownerId))
        .limit(1)
      timeZone = profile?.timezone ?? 'UTC'
    }
    const rows = await db
      .selectDistinct({
        day: sql<string>`to_char(${schema.cookSessions.cookedAt} at time zone ${timeZone}, 'YYYY-MM-DD')`,
      })
      .from(schema.cookSessions)
      .where(eq(schema.cookSessions.ownerId, ownerId))
    // en-CA formats as YYYY-MM-DD
    const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
    return { days: rows.map((r) => r.day), today }
  },

  async getStats(ownerId: string, since?: Date): Promise<CookStats> {
    const db = getDb()
    const windowStart = since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days

    // Top recipes by cook count
    const topRecipes = await db
      .select({
        recipeId: schema.cookSessions.recipeId,
        // Latest title snapshot, so renamed or deleted recipes still read well
        title: sql<
          string | null
        >`(array_agg(${schema.cookSessions.recipeTitle} order by ${schema.cookSessions.cookedAt} desc))[1]`,
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

    // Same window as the other two figures, so the screen never mixes periods
    const [totalRow] = await db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(schema.cookSessions)
      .where(
        and(
          eq(schema.cookSessions.ownerId, ownerId),
          gte(schema.cookSessions.cookedAt, windowStart),
        ),
      )

    return {
      topRecipes: topRecipes.map((r) => ({
        recipeId: r.recipeId,
        title: r.title,
        count: r.count,
        lastCookedAt: r.lastCookedAt,
      })),
      frequencyByWeek: frequencyByWeek.map((r) => ({ week: r.week, count: r.count })),
      totalSessions: totalRow?.total ?? 0,
      windowStart,
    }
  },
}
