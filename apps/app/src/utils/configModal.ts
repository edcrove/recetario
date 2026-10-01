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
