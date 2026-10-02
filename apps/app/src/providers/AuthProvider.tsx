import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authStorage as storage } from '../utils/authStorage'
import { api, setOnUnauthorized } from '../api/client'
import { queryClient } from './QueryProvider'
import { jwtSubject } from '../utils/jwtSubject'

const TOKEN_KEY = 'auth_token'

interface AuthState {
  token: string | null
  userId: string | null
  isLoading: boolean
  signIn: (token: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  token: null,
  userId: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    storage
      .get(TOKEN_KEY)
      .then((t) => setToken(t))
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!token) {
      setUserId(null)
      return
    }
    // Known from the token right away; /auth/me confirms it
    setUserId(jwtSubject(token))
    api.auth
      .me()
      .then((me) => setUserId(me.id))
      // Keep the token's id: a 401 signs out anyway (onUnauthorized), and a
      // network blip shouldn't make every own dish and recipe read-only
      .catch(() => {})
  }, [token])

  // Every session change drops the query cache: it is a module singleton with a
  // 30s staleTime, so on a shared family device the next user would otherwise
  // see the previous user's recipes, profile (allergens) and households.
  const signIn = useCallback(async (newToken: string) => {
    await storage.set(TOKEN_KEY, newToken)
    queryClient.clear()
    setToken(newToken)
  }, [])

  const signOut = useCallback(async () => {
    await storage.del(TOKEN_KEY)
    queryClient.clear()
    setToken(null)
  }, [])

  // Any API 401 means the stored session is expired/invalid: drop it so
  // AuthGuard redirects to /auth/login. Guarded by hasSession so the
  // login screen's own wrong-password 401s don't churn state.
  useEffect(() => {
    setOnUnauthorized(() => {
      setToken((current) => {
        if (current) {
          void storage.del(TOKEN_KEY)
          queryClient.clear()
        }
        return null
      })
    })
    return () => setOnUnauthorized(null)
  }, [])

  const value = useMemo(
    () => ({ token, userId, isLoading, signIn, signOut }),
    [token, userId, isLoading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await storage.get(TOKEN_KEY)
  } catch {
    return null
  }
}
