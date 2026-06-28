import { z } from 'zod'

export const MenuSlotSchema = z.enum(['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros'])
export type MenuSlot = z.infer<typeof MenuSlotSchema>

export const MenuEntrySchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  slot: MenuSlotSchema,
  recipeId: z.string().uuid(),
  servings: z.number().int().positive(),
  recipeName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type MenuEntry = z.infer<typeof MenuEntrySchema>

export const CreateMenuEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: MenuSlotSchema,
  recipeId: z.string().uuid(),
  servings: z.number().int().positive().default(1),
})
export type CreateMenuEntry = z.infer<typeof CreateMenuEntrySchema>

export const MenuWeekSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(MenuEntrySchema),
})
export type MenuWeek = z.infer<typeof MenuWeekSchema>
