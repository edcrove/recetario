import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../providers/AuthProvider'
import { joinedDiners, withDiners } from '../utils/householdDiners'
import { useProfile } from './useProfile'

/**
 * What the allergen and diet warnings check against: the user's own profile
 * plus everyone who eats in their households (a kid without an account, the
 * partner's allergies…). `own` is the profile alone, to tell whose each is.
 */
export function useDietaryContext() {
  const { token, userId } = useAuth()
  const { data: own } = useProfile()
  const { data: households } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.households.mine(),
    enabled: !!token,
  })
  const diners = joinedDiners(households, userId)
  return { profile: own ? withDiners(own, diners) : undefined, own, diners }
}
