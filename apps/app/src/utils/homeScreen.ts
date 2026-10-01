import type { Recipe } from '@recetario/shared'

export function getEmptyMessage(query: string, recipes: Recipe[], hasFilters = false): string {
  if (recipes.length > 0) return ''
  return query || hasFilters ? 'Sin resultados' : 'No hay recetas aún'
}

/** First-run state: no recipes at all (not a search or filter that matched nothing). */
export function isFirstRun(query: string, recipes: Recipe[], hasFilters = false): boolean {
  return recipes.length === 0 && !query && !hasFilters
}

/** The list endpoint has no food-type filter, so a selected chip also goes through search. */
export function getQueryFnKey(query: string, foodTypeId: string | null = null): 'search' | 'list' {
  return query.trim() || foodTypeId ? 'search' : 'list'
}
