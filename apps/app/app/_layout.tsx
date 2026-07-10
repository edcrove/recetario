import { useEffect } from 'react'
import { Stack, useRouter, usePathname } from 'expo-router'
import { QueryProvider } from '../src/providers/QueryProvider'
import { AuthProvider, useAuth } from '../src/providers/AuthProvider'
import { ErrorBoundary } from '../src/components/ErrorBoundary'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return
    if (!token && !pathname.startsWith('/auth')) {
      router.replace('/auth/login')
    }
  }, [token, isLoading, pathname, router])

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryProvider>
          <AuthGuard>
            <Stack>
              <Stack.Screen name="index" options={{ title: 'Recetario' }} />
              <Stack.Screen name="recipe/[id]" options={{ title: 'Receta' }} />
              <Stack.Screen name="recipe/new" options={{ title: 'Nueva Receta' }} />
              <Stack.Screen name="recipe/[id]/edit" options={{ title: 'Editar Receta' }} />
              <Stack.Screen name="recipe/[id]/cook" options={{ headerShown: false }} />
              <Stack.Screen name="menu/index" options={{ title: 'Menú Semanal' }} />
              <Stack.Screen name="menu/pick" options={{ title: 'Elegir Receta' }} />
              <Stack.Screen name="menu/shopping-list" options={{ title: 'Lista de Compras' }} />
              <Stack.Screen name="auth/login" options={{ title: 'Sign In', headerShown: false }} />
              <Stack.Screen
                name="auth/register"
                options={{ title: 'Create Account', headerShown: false }}
              />
              <Stack.Screen
                name="auth/forgot"
                options={{ title: 'Reset Password', headerShown: false }}
              />
              <Stack.Screen name="profile/index" options={{ title: 'Profile' }} />
              <Stack.Screen name="household/index" options={{ title: 'Household' }} />
              <Stack.Screen name="stats/index" options={{ title: 'Cooking Stats' }} />
              <Stack.Screen name="library/index" options={{ title: 'Biblioteca' }} />
              <Stack.Screen name="collections/index" options={{ title: 'Collections' }} />
              <Stack.Screen name="collections/[id]" options={{ title: 'Colección' }} />
              <Stack.Screen name="config/index" options={{ title: 'Configuración' }} />
            </Stack>
          </AuthGuard>
        </QueryProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
