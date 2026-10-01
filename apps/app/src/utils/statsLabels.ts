/** Display name for a top-cooked recipe: its title snapshot, flagged when deleted. */
export function topRecipeLabel(r: { recipeId: string | null; title: string | null }): string {
  const title = r.title?.trim() || 'Receta'
  return r.recipeId ? title : `${title} (eliminada)`
}

/** "desde el 3 jul" — the window every stats figure covers. */
export function statsWindowLabel(since: string): string {
  const d = new Date(since + 'T00:00:00Z')
  const date = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `desde el ${date}`
}
