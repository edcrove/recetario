import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authStorage as storage } from '../utils/authStorage'
import { api } from '../api/client'

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
    api.auth
      .me()
      .then((me) => setUserId(me.id))
      .catch(() => setUserId(null))
  }, [token])

  const signIn = useCallback(async (newToken: string) => {
    await storage.set(TOKEN_KEY, newToken)
    setToken(newToken)
  }, [])

  const signOut = useCallback(async () => {
    await storage.del(TOKEN_KEY)
    setToken(null)
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
