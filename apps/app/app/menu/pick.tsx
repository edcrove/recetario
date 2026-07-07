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
import { notify } from '../../src/utils/platformAlert'
import { AllergenBadge } from '../../src/components/AllergenBadge'
import type { Recipe } from '@recetario/shared'

export default function PickRecipeScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { date, slot, weekStart } = useLocalSearchParams<{
    date: string
    slot: string
    weekStart: string
  }>()
  const [query, setQuery] = useState('')
  const [servings, setServings] = useState(2)

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
        servings,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu', weekStart] })
      router.back()
    },
    onError: () => notify('Error', 'No se pudo agregar la receta al menú.'),
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text testID="pick-header-slot-date" style={styles.subtitle}>
          {slot} · {date}
        </Text>
        <View style={styles.servingsRow}>
          <Text style={styles.servingsLabel}>Porciones:</Text>
          <TouchableOpacity
            style={styles.servingsBtn}
            onPress={() => setServings((v) => Math.max(1, v - 1))}
          >
            <Text style={styles.servingsBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.servingsValue}>{servings}</Text>
          <TouchableOpacity style={styles.servingsBtn} onPress={() => setServings((v) => v + 1)}>
            <Text style={styles.servingsBtnText}>+</Text>
          </TouchableOpacity>
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
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <AllergenBadge recipe={item} />
              </View>
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
  servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  servingsLabel: { fontSize: 14, color: '#6b7280', flex: 1 },
  servingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingsBtnText: { fontSize: 20, color: '#374151', lineHeight: 22 },
  servingsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    minWidth: 28,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', flex: 1 },
  cardMeta: { color: '#666', marginTop: 4, fontSize: 13 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  errorText: { color: '#ef4444', textAlign: 'center', padding: 12 },
})
