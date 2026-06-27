import { Stack } from 'expo-router'
import { QueryProvider } from '../src/providers/QueryProvider'

export default function RootLayout() {
  return (
    <QueryProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Recetario' }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Receta' }} />
        <Stack.Screen name="recipe/new" options={{ title: 'Nueva Receta' }} />
        <Stack.Screen name="recipe/[id]/edit" options={{ title: 'Editar Receta' }} />
      </Stack>
    </QueryProvider>
  )
}
