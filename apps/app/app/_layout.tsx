import { Stack } from 'expo-router'
import { QueryProvider } from '../src/providers/QueryProvider'
import { AuthProvider } from '../src/providers/AuthProvider'

export default function RootLayout() {
  return (
    <AuthProvider>
      <QueryProvider>
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
        </Stack>
      </QueryProvider>
    </AuthProvider>
  )
}
