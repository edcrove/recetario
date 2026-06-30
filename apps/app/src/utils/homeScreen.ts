import type { Recipe } from '@recetario/shared'

export function getEmptyMessage(query: string, recipes: Recipe[]): string {
  if (recipes.length > 0) return ''
  return query ? 'Sin resultados' : 'No hay recetas aún'
}

export function getQueryFnKey(query: string): 'search' | 'list' {
  return query.trim() ? 'search' : 'list'
}
