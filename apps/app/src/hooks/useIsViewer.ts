import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../providers/AuthProvider'
import { isViewerInAnyHousehold } from '../utils/roles'

/**
 * True when the signed-in user is a household viewer. The API 403s their
 * writes to the shared menu, shopping checks and pantry, so screens hide
 * those affordances and show a ViewerNotice instead.
 */
export function useIsViewer(): boolean {
  const { userId } = useAuth()
  const { data: households } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.households.mine(),
  })
  return isViewerInAnyHousehold(households, userId)
}
