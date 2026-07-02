import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { api } from '../../src/api/client'
import type { Recipe } from '@recetario/shared'
import { parseServings } from '../../src/utils/menuLogic'

export default function PickRecipeScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { date, slot, weekStart } = useLocalSearchParams<{
    date: string
    slot: string
    weekStart: string
  }>()
  const [query, setQuery] = useState('')
  const [servings, setServings] = useState('2')

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['recipes', query],
    queryFn: () =>
      query.trim() ? api.recipes.search({ q: query }) : api.recipes.list({ limit: 50 }),
  })

  const addMutation = useMutation({
    mutationFn: (recipe: Recipe) =>
      api.menu.add({
        date: date ?? '',
        slot: slot ?? '',
        recipeId: recipe.id ?? '',
        servings: parseServings(servings, recipe.servings),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu', weekStart] })
      router.back()
    },
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {slot} · {date}
        </Text>
        <View style={styles.servingsRow}>
          <Text style={styles.servingsLabel}>Porciones:</Text>
          <TextInput
            style={styles.servingsInput}
            value={servings}
            onChangeText={setServings}
            keyboardType="numeric"
            selectTextOnFocus
          />
        </View>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Buscar receta..."
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item: Recipe) => item.id ?? item.title}
          renderItem={({ item }: { item: Recipe }) => (
            <TouchableOpacity
              testID={`pick-recipe-${item.id}`}
              style={styles.card}
              onPress={() => addMutation.mutate(item)}
              disabled={addMutation.isPending}
            >
              <Text testID={`pick-recipe-title-${item.id}`} style={styles.cardTitle}>
                {item.title}
              </Text>
              <Text style={styles.cardMeta}>
                {item.category} · {item.servings} porc. base
                {item.totalTimeMin ? ` · ${item.totalTimeMin} min` : ''}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{query ? 'Sin resultados' : 'No hay recetas aún'}</Text>
          }
        />
      )}

      {addMutation.isError && <Text style={styles.errorText}>Error al agregar al menú</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  servingsLabel: { fontSize: 14, color: '#6b7280' },
  servingsInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 6,
    width: 56,
    fontSize: 15,
    textAlign: 'center',
  },
  search: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    margin: 12,
    fontSize: 16,
  },
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardMeta: { color: '#666', marginTop: 4, fontSize: 13 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  errorText: { color: '#ef4444', textAlign: 'center', padding: 12 },
})
