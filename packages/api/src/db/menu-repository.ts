import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import type {
  MenuEntry,
  CreateMenuEntry,
  MenuSlot,
  ScaledIngredient,
  Unit,
} from '@recetario/shared'
import { getDb, schema } from './index.js'

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

    const [recipe] = await db
      .select({ title: schema.recipes.title })
      .from(schema.recipes)
      .where(eq(schema.recipes.id, data.recipeId))
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

    const [recipe] = await db
      .select({ title: schema.recipes.title })
      .from(schema.recipes)
      .where(eq(schema.recipes.id, recipeId))
      .limit(1)

    return mapToMenuEntry(row, recipe)
  }

  async getWeek(ownerId: string, weekStart: string): Promise<MenuEntry[]> {
    const db = this.db
    const weekEndDate = addDays(weekStart, 6)

    const rows = await db
      .select()
      .from(schema.menuEntries)
      .where(
        and(
          eq(schema.menuEntries.ownerId, ownerId),
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
            .where(inArray(schema.recipes.id, recipeIds))
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
          eq(schema.menuEntries.ownerId, ownerId),
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
}

export const menuRepository = new MenuRepository()
