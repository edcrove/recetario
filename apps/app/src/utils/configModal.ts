export interface DeletableItem {
  name: string
  usageCount: number
  isDeletable: boolean
}

/** Title of the taxonomy delete modal; empty while it animates out with no target. */
export function deleteModalTitle(item: DeletableItem | null): string {
  if (!item) return ''
  if (item.isDeletable) return `¿Eliminar "${item.name}"?`
  const n = item.usageCount
  return `"${item.name}" está en ${n} ${n === 1 ? 'receta' : 'recetas'}`
}

export type EditableTab = 'categories' | 'food-types' | 'tags'

const NEW_ITEM_PLACEHOLDER: Record<EditableTab, string> = {
  categories: 'Nueva categoría',
  'food-types': 'Nuevo tipo de comida',
  tags: 'Nueva etiqueta',
}

/** Placeholder of the "create item" input on each taxonomy tab. */
export function newItemPlaceholder(tab: EditableTab): string {
  return NEW_ITEM_PLACEHOLDER[tab]
}

/** Alert shown when creating an item fails: a 409 means the name is already on the list. */
export function createErrorAlert(err: unknown, name: string): { title: string; message: string } {
  if (err instanceof Error && err.message.startsWith('API 409')) {
    return { title: 'Ya existe', message: `"${name}" ya está en la lista.` }
  }
  return { title: 'Error', message: 'No se pudo crear el elemento.' }
}

/** Accessible label of the usage badge, which opens the list of recipes behind it. */
export function usageBadgeLabel(item: { name: string; usageCount: number }): string {
  const n = item.usageCount
  return `Ver ${n} ${n === 1 ? 'receta' : 'recetas'} con "${item.name}"`
}

/** Title of the usage modal; empty while it animates out with no item. */
export function usageModalTitle(item: { name: string } | null): string {
  return item ? `Recetas con "${item.name}"` : ''
}
