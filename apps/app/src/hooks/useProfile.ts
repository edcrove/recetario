import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export const PROFILE_QUERY_KEY = ['profile'] as const

/**
 * The signed-in user's profile (allergens, diet, goals, time zone). One query
 * definition shared by every reader, so the cache entry has a single source.
 */
export function useProfile(enabled = true) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => api.auth.getProfile(),
    enabled,
  })
}
