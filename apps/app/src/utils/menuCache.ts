import type { QueryClient } from '@tanstack/react-query'

/**
 * Everything derived from a week's menu: after adding, removing or resizing an
 * entry, the planner, the per-day nutrition, the shopping list and the fridge
 * gap view must all refetch, not just the planner grid.
 */
export function invalidateMenuWeek(queryClient: QueryClient, weekStart: string): void {
  for (const queryKey of [
    ['menu', weekStart],
    ['day-nutrition'],
    ['shopping-list', weekStart],
    ['menu-gap', weekStart],
  ]) {
    void queryClient.invalidateQueries({ queryKey })
  }
}

/**
 * What each kind of edit makes stale elsewhere. Every screen caches its reads
 * for 30s (QueryProvider), so an edit that only refreshed its own screen left
 * the others showing old data when you went back to them:
 * - pantry: the week's "falta: …" and the cook-now suggestions;
 * - goals (daily targets): the planner's per-day summary and the suggestions;
 * - recipe (edited or deleted): titles, nutrition and ingredients wherever the
 *   recipe is planned, listed or collected.
 */
const STALE_AFTER = {
  pantry: [['pantry'], ['menu-gap'], ['suggestions']],
  goals: [['day-nutrition'], ['suggestions']],
  recipe: [
    ['recipes'],
    ['menu'],
    ['day-nutrition'],
    ['shopping-list'],
    ['menu-gap'],
    ['suggestions'],
    ['collections'],
    ['collection-recipes'],
  ],
} as const

export function refreshAfter(
  queryClient: QueryClient,
  change: keyof typeof STALE_AFTER,
): Promise<void[]> {
  return Promise.all(
    STALE_AFTER[change].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  )
}
