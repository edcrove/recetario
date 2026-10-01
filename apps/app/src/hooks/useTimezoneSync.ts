import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useProfile, PROFILE_QUERY_KEY } from './useProfile'
import { deviceTimeZone, timezoneToSync } from '../utils/timezone'

/**
 * Stores the device's time zone on the profile when it is still the UTC
 * default, so server-side "today" and week math match the user's clock.
 */
export function useTimezoneSync(enabled: boolean) {
  const queryClient = useQueryClient()
  const { data: profile } = useProfile(enabled)
  const tz = profile ? timezoneToSync(profile.timezone, deviceTimeZone()) : null
  useEffect(() => {
    if (!tz) return
    void api.auth
      .updateProfile({ timezone: tz })
      .then(() => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }))
      .catch(() => undefined) // best effort; retried on the next launch
  }, [tz, queryClient])
}
