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
