import type { Recipe } from '@recetario/shared'

export function getEmptyMessage(query: string, recipes: Recipe[], hasFilters = false): string {
  if (recipes.length > 0) return ''
  return query || hasFilters ? 'Sin resultados' : 'No hay recetas aún'
}

/** The list endpoint has no food-type filter, so a selected chip also goes through search. */
export function getQueryFnKey(query: string, foodTypeId: string | null = null): 'search' | 'list' {
  return query.trim() || foodTypeId ? 'search' : 'list'
}
