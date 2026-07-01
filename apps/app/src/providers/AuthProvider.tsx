import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authStorage as storage } from '../utils/authStorage'

const TOKEN_KEY = 'auth_token'

interface AuthState {
  token: string | null
  isLoading: boolean
  signIn: (token: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  token: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    storage
      .get(TOKEN_KEY)
      .then((t) => setToken(t))
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false))
  }, [])

  const signIn = useCallback(async (newToken: string) => {
    await storage.set(TOKEN_KEY, newToken)
    setToken(newToken)
  }, [])

  const signOut = useCallback(async () => {
    await storage.del(TOKEN_KEY)
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
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
