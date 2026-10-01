import type { Recipe } from '@recetario/shared'

export function getEmptyMessage(query: string, recipes: Recipe[], hasFilters = false): string {
  if (recipes.length > 0) return ''
  return query || hasFilters ? 'Sin resultados' : 'No hay recetas aún'
}

/** First-run state: no recipes at all (not a search or filter that matched nothing). */
export function isFirstRun(query: string, recipes: Recipe[], hasFilters = false): boolean {
  return recipes.length === 0 && !query && !hasFilters
}

/** The list endpoint has no food-type or diet filter, so a selected chip also goes through search. */
export function getQueryFnKey(
  query: string,
  foodTypeId: string | null = null,
  dietary: string | null = null,
): 'search' | 'list' {
  return query.trim() || foodTypeId || dietary ? 'search' : 'list'
}

/**
 * Search params for the home list: text, food type and diet all combine (the
 * API ANDs them), so "Vegano" + "Postres" means vegan desserts. Unset ones
 * are left out rather than sent empty.
 */
export function homeSearchParams(
  query: string,
  foodTypeId: string | null,
  dietary: string | null,
): { q?: string; foodTypeId?: string; dietary?: string } {
  return {
    ...(query.trim() ? { q: query.trim() } : {}),
    ...(foodTypeId ? { foodTypeId } : {}),
    ...(dietary ? { dietary } : {}),
  }
}
