import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../src/api/client'
import { notify, confirmAsync } from '../../src/utils/platformAlert'
import type { Recipe } from '@recetario/shared'

export default function CollectionDetailScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id, name, emoji } = useLocalSearchParams<{
    id: string
    name?: string
    emoji?: string
  }>()

  const {
    data: recipes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['collection-recipes', id],
    queryFn: () => api.taxonomy.collectionRecipes(id),
  })

  const removeMutation = useMutation({
    mutationFn: (recipeId: string) => api.taxonomy.removeFromCollection(id, recipeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collection-recipes', id] })
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
    onError: () => notify('Error', 'No se pudo quitar la receta de la colección.'),
  })

  if (isLoading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  if (error)
    return (
      <View style={s.center}>
        <Text style={s.errorText}>No se pudo cargar la colección.</Text>
      </View>
    )

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text testID="collection-detail-title" style={s.title}>
          {emoji ?? '📋'} {name ?? 'Colección'}
        </Text>
      </View>

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id ?? ''}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text testID="collection-detail-empty" style={s.empty}>
            Sin recetas en esta colección.
          </Text>
        }
        renderItem={({ item }) => {
          const recipeId = item.id ?? ''
          return (
            <RecipeRow
              recipe={item}
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipeId } })}
              onRemove={async () => {
                const confirmed = await confirmAsync(
                  'Quitar de la colección',
                  `¿Quitar "${item.title}" de esta colección?`,
                )
                if (confirmed) removeMutation.mutate(recipeId)
              }}
            />
          )
        }}
      />
    </View>
  )
}

function RecipeRow({
  recipe,
  onPress,
  onRemove,
}: {
  recipe: Recipe
  onPress: () => void
  onRemove: () => void
}) {
  return (
    <View style={s.card}>
      <TouchableOpacity
        testID={`collection-recipe-${recipe.id}`}
        style={s.cardInfo}
        onPress={onPress}
      >
        <Text style={s.cardTitle}>{recipe.title}</Text>
        <Text style={s.cardMeta}>
          {recipe.category} · {recipe.servings} porciones
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`collection-remove-${recipe.id}`}
        style={s.removeBtn}
        onPress={onRemove}
      >
        <Text style={s.removeBtnText}>Quitar</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 14 },
  header: { padding: 16, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  list: { padding: 16, gap: 8 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 32, fontSize: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardMeta: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  removeBtn: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  removeBtnText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
})
