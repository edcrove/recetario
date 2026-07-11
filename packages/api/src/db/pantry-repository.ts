import { eq, inArray, and } from 'drizzle-orm'
import { getDb, schema } from './index.js'
import { getVisibleOwnerIds } from './household-visibility.js'

export interface PantryItem {
  id: string
  ownerId: string
  name: string
  quantity: string | null
  unit: string | null
  expiryDate: string | null
  inStock: boolean
}

export interface CreatePantryItem {
  name: string
  quantity?: string | null
  unit?: string | null
  expiryDate?: string | null
  inStock?: boolean
}

export type UpdatePantryItem = Partial<CreatePantryItem>

function toItem(row: typeof schema.pantryItems.$inferSelect): PantryItem {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    expiryDate: row.expiryDate,
    inStock: row.inStock,
  }
}

export class PantryRepository {
  private get db() {
    return getDb()
  }

  /** All pantry items visible to the caller (their household's), newest first. */
  async list(ownerId: string): Promise<PantryItem[]> {
    const visibleOwners = await getVisibleOwnerIds(ownerId)
    const rows = await this.db
      .select()
      .from(schema.pantryItems)
      .where(inArray(schema.pantryItems.ownerId, visibleOwners))
    return rows
      .map(toItem)
      .sort((a, b) => Number(a.inStock) - Number(b.inStock) || a.name.localeCompare(b.name))
  }

  /** In-stock item names visible to the caller — for shopping-list matching. */
  async listInStockNames(ownerId: string): Promise<string[]> {
    const visibleOwners = await getVisibleOwnerIds(ownerId)
    const rows = await this.db
      .select({ name: schema.pantryItems.name })
      .from(schema.pantryItems)
      .where(
        and(
          inArray(schema.pantryItems.ownerId, visibleOwners),
          eq(schema.pantryItems.inStock, true),
        ),
      )
    return rows.map((r) => r.name)
  }

  async create(ownerId: string, data: CreatePantryItem): Promise<PantryItem> {
    const [row] = await this.db
      .insert(schema.pantryItems)
      .values({
        ownerId,
        name: data.name,
        quantity: data.quantity ?? null,
        unit: data.unit ?? null,
        expiryDate: data.expiryDate ?? null,
        inStock: data.inStock ?? true,
      })
      .returning()
    return toItem(row!)
  }

  /** The item if it is visible to the caller's household, else null. */
  private async getVisible(ownerId: string, id: string): Promise<PantryItem | null> {
    const visibleOwners = await getVisibleOwnerIds(ownerId)
    const [row] = await this.db
      .select()
      .from(schema.pantryItems)
      .where(eq(schema.pantryItems.id, id))
    if (!row || !visibleOwners.includes(row.ownerId)) return null
    return toItem(row)
  }

  async update(ownerId: string, id: string, patch: UpdatePantryItem): Promise<PantryItem | null> {
    const visible = await this.getVisible(ownerId, id)
    if (!visible) return null
    const [row] = await this.db
      .update(schema.pantryItems)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
        ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
        ...(patch.expiryDate !== undefined ? { expiryDate: patch.expiryDate } : {}),
        ...(patch.inStock !== undefined ? { inStock: patch.inStock } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.pantryItems.id, id))
      .returning()
    return toItem(row!)
  }

  async remove(ownerId: string, id: string): Promise<boolean> {
    const visible = await this.getVisible(ownerId, id)
    if (!visible) return false
    await this.db.delete(schema.pantryItems).where(eq(schema.pantryItems.id, id))
    return true
  }
}

export const pantryRepository = new PantryRepository()
