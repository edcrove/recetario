import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useSuggestions(enabled = true) {
  const { data: stats } = useQuery({
    queryKey: ['cook-stats-suggestions'],
    queryFn: () => api.cookSessions.stats(),
    enabled,
  })

  const topIds = (stats?.topRecipes ?? []).slice(0, 3).map((r) => r.recipeId)

  const { data: allRelations = [] } = useQuery({
    queryKey: ['suggestions-relations', topIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(topIds.map((id) => api.taxonomy.relations(id)))
      return results.flat()
    },
    enabled: enabled && topIds.length > 0,
  })

  const cooked = new Set(stats?.topRecipes.map((r) => r.recipeId) ?? [])
  const suggested = allRelations
    .filter((r) => !cooked.has(r.toId))
    .reduce<string[]>((acc, r) => {
      if (!acc.includes(r.toId)) acc.push(r.toId)
      return acc
    }, [])
    .slice(0, 4)

  return { suggested, isReady: enabled && topIds.length > 0 }
}
