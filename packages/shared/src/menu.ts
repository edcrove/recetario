import { z } from 'zod'

export const MenuSlotSchema = z.enum(['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros'])
export type MenuSlot = z.infer<typeof MenuSlotSchema>

export const MenuEntrySchema = z.object({
  id: z.uuid(),
  ownerId: z.string(),
  date: z.iso.date(), // YYYY-MM-DD
  slot: MenuSlotSchema,
  // Nullable: deleting a recipe sets this to null instead of destroying the
  // menu entry (see 2026-07-03 audit finding). recipeName still resolves via
  // the recipeTitle snapshot taken when the entry was created.
  recipeId: z.uuid().nullable(),
  servings: z.number().int().positive(),
  recipeName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type MenuEntry = z.infer<typeof MenuEntrySchema>

export const CreateMenuEntrySchema = z.object({
  date: z.iso.date(),
  slot: MenuSlotSchema,
  recipeId: z.uuid(),
  servings: z.number().int().positive().default(1),
})
export type CreateMenuEntry = z.infer<typeof CreateMenuEntrySchema>

export const MenuWeekSchema = z.object({
  weekStart: z.iso.date(),
  entries: z.array(MenuEntrySchema),
})
export type MenuWeek = z.infer<typeof MenuWeekSchema>

/** Shifts a YYYY-MM-DD date by whole days in UTC (no DST or local-zone drift). */
export function addIsoDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
