import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateRecipe } from '@recetario/shared'
import { api } from '../../src/api/client'
import { RecipeForm, EMPTY_FORM } from '../../src/components/RecipeForm'

export default function NewRecipeScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: CreateRecipe) => api.recipes.create(data),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['recipes'] })
      // replace, not back(): opened directly (reload, link, PWA) there is no
      // history, and the form would sit there inviting a duplicate save.
      router.replace(`/recipe/${created.id}?saved=1`)
    },
  })

  return (
    <RecipeForm
      initial={EMPTY_FORM}
      submitLabel="Guardar Receta"
      isPending={mutation.isPending}
      submitError={mutation.error?.message}
      onSubmit={(payload) => mutation.mutate(payload)}
    />
  )
}
