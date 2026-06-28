import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import type { MenuEntry, CreateMenuEntry, MenuSlot } from '@recetario/shared'
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
    recipeName: recipe?.title,
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

    const [row] = await db
      .insert(schema.menuEntries)
      .values({
        ownerId,
        date: data.date,
        slot: data.slot,
        recipeId: data.recipeId,
        servings: data.servings,
      })
      .onConflictDoUpdate({
        target: [schema.menuEntries.ownerId, schema.menuEntries.date, schema.menuEntries.slot],
        set: {
          recipeId: data.recipeId,
          servings: data.servings,
          updatedAt: new Date(),
        },
      })
      .returning()

    /* v8 ignore next */
    if (!row) throw new Error('Failed to upsert menu entry')

    const [recipe] = await db
      .select({ title: schema.recipes.title })
      .from(schema.recipes)
      .where(eq(schema.recipes.id, row.recipeId))
      .limit(1)

    return mapToMenuEntry(row, recipe)
  }

  async remove(ownerId: string, date: string, slot: MenuSlot): Promise<boolean> {
    const db = this.db
    const result = await db
      .delete(schema.menuEntries)
      .where(
        and(
          eq(schema.menuEntries.ownerId, ownerId),
          eq(schema.menuEntries.date, date),
          eq(schema.menuEntries.slot, slot),
        ),
      )
      .returning({ id: schema.menuEntries.id })

    return result.length > 0
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

    const recipeIds = [...new Set(rows.map((r) => r.recipeId))]
    const recipes = await db
      .select({ id: schema.recipes.id, title: schema.recipes.title })
      .from(schema.recipes)
      .where(inArray(schema.recipes.id, recipeIds))

    const recipeMap = new Map(recipes.map((r) => [r.id, r.title]))

    return rows.map((row) =>
      /* v8 ignore next */
      mapToMenuEntry(
        row,
        recipeMap.has(row.recipeId) ? { title: recipeMap.get(row.recipeId)! } : undefined,
      ),
    )
  }
}

export const menuRepository = new MenuRepository()
