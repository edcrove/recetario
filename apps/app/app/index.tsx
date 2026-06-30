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
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { api } from '../src/api/client'
import type { Recipe } from '@recetario/shared'
import { getEmptyMessage, getQueryFnKey } from '../src/utils/homeScreen'

export default function HomeScreen() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const {
    data: recipes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['recipes', query],
    queryFn: () =>
      getQueryFnKey(query) === 'search'
        ? api.recipes.search({ q: query })
        : api.recipes.list({ limit: 50 }),
  })

  if (isLoading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  if (error)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error loading recipes</Text>
      </View>
    )

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recetario</Text>
      <TextInput
        style={styles.search}
        placeholder="Buscar recetas..."
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
      />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/recipe/new')}>
          <Text style={styles.addButtonText}>+ Nueva Receta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/menu')}>
          <Text style={styles.menuButtonText}>Menú Semanal</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={recipes}
        keyExtractor={(item: Recipe) => item.id ?? item.title}
        renderItem={({ item }: { item: Recipe }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/recipe/${item.id}`)}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {item.category} · {item.servings} porciones
              {item.totalTimeMin ? ` · ${item.totalTimeMin} min` : ''}
            </Text>
            {item.tags.length > 0 && <Text style={styles.tags}>{item.tags.join(', ')}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{getEmptyMessage(query, recipes)}</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 12 },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  menuButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#16a34a',
    borderRadius: 8,
  },
  menuButtonText: { color: '#fff', fontWeight: '600' },
  card: { padding: 16, borderRadius: 8, backgroundColor: '#f9f9f9', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardMeta: { color: '#666', marginTop: 4 },
  tags: { color: '#999', fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  error: { color: 'red' },
})
