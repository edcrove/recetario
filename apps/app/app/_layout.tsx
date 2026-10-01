import { useEffect } from 'react'
import {
  Stack,
  useRouter,
  usePathname,
  ThemeProvider as NavigationThemeProvider,
  DefaultTheme,
} from 'expo-router'
import { QueryProvider } from '../src/providers/QueryProvider'
import { AuthProvider, useAuth } from '../src/providers/AuthProvider'
import { useTimezoneSync } from '../src/hooks/useTimezoneSync'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { ThemeProvider } from '../src/theme/ThemeProvider'
import { useThemeColors, fonts } from '../src/theme/tokens'

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
  useTimezoneSync(!!token && !isLoading)

  return <>{children}</>
}

/**
 * One navigation stack themed from the app tokens (the default header stayed white
 * in dark mode), with Spanish titles for every route. Screens that draw their own
 * header with a back link hide the stack header so there is never a double title.
 */
/** Widest content column on desktop web; phones and tablets are narrower anyway. */
const CONTENT_MAX_WIDTH = 960

function AppStack() {
  const c = useThemeColors()
  const own = { headerShown: false }
  // The navigator paints the area around the centered content column on wide
  // screens; give it the app palette instead of react-navigation's default white.
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: c.paper,
      card: c.surface,
      text: c.ink,
      border: c.line,
      primary: c.terracotta,
    },
  }
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.terracotta,
          headerTitleStyle: { color: c.ink, fontFamily: fonts.display },
          headerShadowVisible: false,
          // Desktop web: keep content at a readable width, centered (2026-10-01 audit)
          contentStyle: {
            backgroundColor: c.paper,
            width: '100%',
            maxWidth: CONTENT_MAX_WIDTH,
            alignSelf: 'center',
          },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Recetario', ...own }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Receta' }} />
        <Stack.Screen name="recipe/new" options={{ title: 'Nueva receta' }} />
        <Stack.Screen name="recipe/[id]/edit" options={{ title: 'Editar receta' }} />
        <Stack.Screen name="recipe/[id]/cook" options={{ title: 'Modo cocina', ...own }} />
        <Stack.Screen name="menu/index" options={{ title: 'Menú semanal' }} />
        <Stack.Screen name="menu/pick" options={{ title: 'Elegir receta' }} />
        <Stack.Screen name="menu/shopping-list" options={{ title: 'Lista de compras', ...own }} />
        <Stack.Screen name="heladera/index" options={{ title: '¿Qué cocino?', ...own }} />
        <Stack.Screen name="pantry/index" options={{ title: 'Despensa', ...own }} />
        <Stack.Screen name="auth/login" options={{ title: 'Ingresar', ...own }} />
        <Stack.Screen name="auth/register" options={{ title: 'Crear cuenta', ...own }} />
        <Stack.Screen name="auth/forgot" options={{ title: 'Restablecer contraseña', ...own }} />
        <Stack.Screen name="profile/index" options={{ title: 'Mi perfil' }} />
        <Stack.Screen name="household/index" options={{ title: 'Mi hogar' }} />
        <Stack.Screen name="stats/index" options={{ title: 'Estadísticas' }} />
        <Stack.Screen name="library/index" options={{ title: 'Biblioteca' }} />
        <Stack.Screen name="collections/index" options={{ title: 'Colecciones' }} />
        <Stack.Screen name="collections/[id]" options={{ title: 'Colección' }} />
        <Stack.Screen name="config/index" options={{ title: 'Configuración' }} />
      </Stack>
    </NavigationThemeProvider>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <QueryProvider>
            <AuthGuard>
              <AppStack />
            </AuthGuard>
          </QueryProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
