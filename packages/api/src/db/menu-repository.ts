import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import type {
  MenuEntry,
  CreateMenuEntry,
  MenuSlot,
  ScaledIngredient,
  Unit,
  Nutrition,
  DayNutritionEntry,
  NutritionTargets,
} from '@recetario/shared'
import { getDb, schema } from './index.js'
import { getVisibleOwnerIds, UUID_RE } from './household-visibility.js'

type MenuRow = typeof schema.menuEntries.$inferSelect
type RecipeRow = typeof schema.recipes.$inferSelect

function mapToMenuEntry(row: MenuRow, recipe?: Pick<RecipeRow, 'title'>): MenuEntry {
  return {
    id: row.id,
    ownerId: row.ownerId,
    date: row.date,
    slot: row.slot as MenuSlot,
    recipeId: row.recipeId,
    servings: row.servings,
    // Prefer the live recipe's current title; fall back to the snapshot
    // taken when the entry was created (recipe may have been deleted since).
    // The final `?? undefined` only matters for rows predating this column.
    /* v8 ignore next */
    recipeName: recipe?.title ?? row.recipeTitle ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export class MenuRepository {
  private get db() {
    return getDb()
  }

  async upsert(ownerId: string, data: CreateMenuEntry): Promise<MenuEntry> {
    const db = this.db

    // Snapshot the title only from a recipe the user can actually see (own OR
    // household) — the same visibility as reads. Without this owner filter, a
    // POST with someone else's private recipe id would leak its title into the
    // attacker's menu entry (cross-tenant IDOR).
    const visibleOwners = await getVisibleOwnerIds(ownerId)
    const [recipe] = await db
      .select({ title: schema.recipes.title })
      .from(schema.recipes)
      .where(
        and(eq(schema.recipes.id, data.recipeId), inArray(schema.recipes.ownerId, visibleOwners)),
      )
      .limit(1)

    const [row] = await db
      .insert(schema.menuEntries)
      .values({
        ownerId,
        date: data.date,
        slot: data.slot,
        recipeId: data.recipeId,
        recipeTitle: recipe?.title,
        servings: data.servings,
      })
      .onConflictDoUpdate({
        target: [
          schema.menuEntries.ownerId,
          schema.menuEntries.date,
          schema.menuEntries.slot,
          schema.menuEntries.recipeId,
        ],
        set: { servings: data.servings, updatedAt: new Date() },
      })
      .returning()

    /* v8 ignore next */
    if (!row) throw new Error('Failed to upsert menu entry')

    return mapToMenuEntry(row, recipe)
  }

  async remove(ownerId: string, date: string, slot: MenuSlot, recipeId?: string): Promise<boolean> {
    const db = this.db
    const conditions = [
      eq(schema.menuEntries.ownerId, ownerId),
      eq(schema.menuEntries.date, date),
      eq(schema.menuEntries.slot, slot),
      /* v8 ignore next */ ...(recipeId ? [eq(schema.menuEntries.recipeId, recipeId)] : []),
    ]
    const result = await db
      .delete(schema.menuEntries)
      .where(and(...conditions))
      .returning({ id: schema.menuEntries.id })

    return result.length > 0
  }

  /* v8 ignore next 32 */
  async updateServings(
    ownerId: string,
    date: string,
    slot: MenuSlot,
    recipeId: string,
    servings: number,
  ): Promise<MenuEntry | null> {
    const db = this.db
    const [row] = await db
      .update(schema.menuEntries)
      .set({ servings, updatedAt: new Date() })
      .where(
        and(
          eq(schema.menuEntries.ownerId, ownerId),
          eq(schema.menuEntries.date, date),
          eq(schema.menuEntries.slot, slot),
          eq(schema.menuEntries.recipeId, recipeId),
        ),
      )
      .returning()

    if (!row) return null

    // Same visibility scoping as upsert — never re-resolve (and thus leak) the
    // title of a recipe the caller can't see (e.g. an entry pointing at someone
    // else's private recipe id).
    const visibleOwners = await getVisibleOwnerIds(ownerId)
    const [recipe] = await db
      .select({ title: schema.recipes.title })
      .from(schema.recipes)
      .where(and(eq(schema.recipes.id, recipeId), inArray(schema.recipes.ownerId, visibleOwners)))
      .limit(1)

    return mapToMenuEntry(row, recipe)
  }

  async getWeek(ownerId: string, weekStart: string): Promise<MenuEntry[]> {
    const db = this.db
    const weekEndDate = addDays(weekStart, 6)

    // Household-shared read: the week view shows every housemate's entries.
    // Writes (upsert/remove/updateServings) stay strictly owner-scoped.
    const visibleOwners = await getVisibleOwnerIds(ownerId)

    const rows = await db
      .select()
      .from(schema.menuEntries)
      .where(
        and(
          inArray(schema.menuEntries.ownerId, visibleOwners),
          gte(schema.menuEntries.date, weekStart),
          lte(schema.menuEntries.date, weekEndDate),
        ),
      )

    if (rows.length === 0) return []

    const recipeIds = [...new Set(rows.map((r) => r.recipeId).filter((id) => id !== null))]
    const recipes =
      recipeIds.length > 0
        ? await db
            .select({ id: schema.recipes.id, title: schema.recipes.title })
            .from(schema.recipes)
            // Scope to visible owners: an entry may carry a recipeId the caller
            // can't see (e.g. a planted private id) — never resolve its title.
            .where(
              and(
                inArray(schema.recipes.id, recipeIds),
                inArray(schema.recipes.ownerId, visibleOwners),
              ),
            )
        : []

    const recipeMap = new Map(recipes.map((r) => [r.id, r.title]))

    return rows.map((row) => {
      const title = row.recipeId ? recipeMap.get(row.recipeId) : undefined
      /* v8 ignore next */
      const recipeName = title !== undefined ? { title } : undefined
      return mapToMenuEntry(row, recipeName)
    })
  }

  async getScaledIngredients(ownerId: string, weekStart: string): Promise<ScaledIngredient[]> {
    const db = this.db
    const weekEndDate = addDays(weekStart, 6)

    // Same household-shared rule as getWeek: the shopping list aggregates the
    // whole household's planned week, not just the caller's entries.
    const visibleOwners = await getVisibleOwnerIds(ownerId)

    const entries = await db
      .select({
        recipeId: schema.menuEntries.recipeId,
        entryServings: schema.menuEntries.servings,
        recipeServings: schema.recipes.servings,
      })
      .from(schema.menuEntries)
      .innerJoin(schema.recipes, eq(schema.menuEntries.recipeId, schema.recipes.id))
      .where(
        and(
          inArray(schema.menuEntries.ownerId, visibleOwners),
          // Only aggregate recipes the caller can see — a planted foreign id must
          // not leak the victim's ingredients/quantities through the shopping list.
          inArray(schema.recipes.ownerId, visibleOwners),
          gte(schema.menuEntries.date, weekStart),
          lte(schema.menuEntries.date, weekEndDate),
        ),
      )

    if (entries.length === 0) return []

    // The inner join above already excludes rows whose recipeId was set to
    // null (recipe deleted), so this filter is purely to satisfy the type
    // checker — every remaining entry.recipeId is guaranteed non-null here.
    const recipeIds = [...new Set(entries.map((e) => e.recipeId).filter((id) => id !== null))]
    const ingredientRows = await db
      .select()
      .from(schema.ingredients)
      .where(inArray(schema.ingredients.recipeId, recipeIds))

    const scaled: ScaledIngredient[] = []
    for (const entry of entries) {
      const scale = entry.entryServings / entry.recipeServings
      const recipeIngredients = ingredientRows.filter((i) => i.recipeId === entry.recipeId)
      for (const ing of recipeIngredients) {
        const qty = ing.quantity !== null ? Number(ing.quantity) * scale : null
        scaled.push({
          name: ing.name,
          quantity: qty !== null ? Math.round(qty * 1000) / 1000 : null,
          unit: (ing.unit as Unit | null) ?? null,
        })
      }
    }

    return scaled
  }

  /**
   * Checked shopping-list item keys for a week, merged across the household
   * (same visibility rule as the week view). Each member's rows are keyed by
   * (owner, week, itemKey); the most recently updated row for a given itemKey
   * wins, so the latest check/uncheck by anyone in the household is what shows.
   */
  async getShoppingChecks(ownerId: string, weekStart: string): Promise<Set<string>> {
    const db = this.db
    const visibleOwners = await getVisibleOwnerIds(ownerId)
    const rows = await db
      .select({
        itemKey: schema.shoppingListChecks.itemKey,
        checked: schema.shoppingListChecks.checked,
        updatedAt: schema.shoppingListChecks.updatedAt,
      })
      .from(schema.shoppingListChecks)
      .where(
        and(
          inArray(schema.shoppingListChecks.ownerId, visibleOwners),
          eq(schema.shoppingListChecks.weekStart, weekStart),
        ),
      )

    const latest = new Map<string, { checked: boolean; updatedAt: Date }>()
    for (const row of rows) {
      const cur = latest.get(row.itemKey)
      if (!cur || row.updatedAt > cur.updatedAt) {
        latest.set(row.itemKey, { checked: row.checked, updatedAt: row.updatedAt })
      }
    }

    const checkedKeys = new Set<string>()
    for (const [key, value] of latest) {
      if (value.checked) checkedKeys.add(key)
    }
    return checkedKeys
  }

  /** Upserts the caller's check state for one shopping-list item in a week. */
  async setShoppingCheck(
    ownerId: string,
    weekStart: string,
    itemKey: string,
    checked: boolean,
  ): Promise<void> {
    await this.db
      .insert(schema.shoppingListChecks)
      .values({ ownerId, weekStart, itemKey, checked, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [
          schema.shoppingListChecks.ownerId,
          schema.shoppingListChecks.weekStart,
          schema.shoppingListChecks.itemKey,
        ],
        set: { checked, updatedAt: new Date() },
      })
  }

  /**
   * Everything the pure computeDayNutrition() needs for one day: each entry's
   * recipe per-serving nutrition, planned servings and slot (household-shared,
   * same rule as the week view), plus the caller's daily nutrition target.
   * Kept in one method so the route never touches getDb directly.
   */
  async getDayNutritionInputs(
    ownerId: string,
    date: string,
  ): Promise<{ entries: DayNutritionEntry[]; target: NutritionTargets | null }> {
    const db = this.db
    const visibleOwners = await getVisibleOwnerIds(ownerId)

    const rows = await db
      .select({
        slot: schema.menuEntries.slot,
        servings: schema.menuEntries.servings,
        nutrition: schema.recipes.nutrition,
      })
      .from(schema.menuEntries)
      .innerJoin(schema.recipes, eq(schema.menuEntries.recipeId, schema.recipes.id))
      .where(
        and(
          inArray(schema.menuEntries.ownerId, visibleOwners),
          // A planted foreign recipe id must not leak the victim's nutrition.
          inArray(schema.recipes.ownerId, visibleOwners),
          eq(schema.menuEntries.date, date),
        ),
      )

    const entries: DayNutritionEntry[] = rows.map((r) => ({
      mealCategory: r.slot,
      nutrition: (r.nutrition as Nutrition | null) ?? null,
      servings: r.servings,
    }))

    // user_profiles.user_id is a uuid FK to users; API-key/legacy owners (non-uuid)
    // can't have a profile, and comparing a non-uuid against a uuid column would
    // make Postgres throw — short-circuit to no target.
    if (!UUID_RE.test(ownerId)) return { entries, target: null }

    const [profile] = await db
      .select({ nutritionTargets: schema.userProfiles.nutritionTargets })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, ownerId))
      .limit(1)
    // The PATCH /auth/profile route validates against NutritionTargetsSchema
    // before storing, so a cast is safe here (same pattern as the weekly route).
    const target = (profile?.nutritionTargets as NutritionTargets | null) ?? null

    return { entries, target }
  }
}

export const menuRepository = new MenuRepository()
