import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateRecipe } from '@recetario/shared'
import { api } from '../../../src/api/client'
import { recipeToFormState } from '../../../src/utils/recipeForm'
import { RecipeForm } from '../../../src/components/RecipeForm'
import { useThemeColors, type ThemeColors } from '../../../src/theme/tokens'

export default function EditRecipeScreen() {
  const colors = useThemeColors()
  const st = makeStyles(colors)
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: recipe, error } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipes.get(id),
  })

  const mutation = useMutation({
    mutationFn: (data: UpdateRecipe) => api.recipes.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recipes'] })
      void queryClient.invalidateQueries({ queryKey: ['recipe', id] })
      if (router.canGoBack()) router.back()
      else router.replace(`/recipe/${id}?saved=1`)
    },
  })

  if (!recipe)
    return (
      <View style={st.center}>
        {error ? (
          <Text style={st.error}>Receta no encontrada</Text>
        ) : (
          <ActivityIndicator size="large" />
        )}
      </View>
    )

  return (
    <RecipeForm
      key={recipe.id}
      initial={recipeToFormState(recipe)}
      submitLabel="Guardar Cambios"
      isPending={mutation.isPending}
      submitError={mutation.error?.message}
      onSubmit={(payload) => mutation.mutate(payload)}
    />
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    center: { flex: 1, backgroundColor: c.paper, justifyContent: 'center', alignItems: 'center' },
    error: { color: c.danger },
  })
