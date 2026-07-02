import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { api } from '../src/api/client'
import type { Recipe } from '@recetario/shared'
import { getEmptyMessage, getQueryFnKey } from '../src/utils/homeScreen'
import { useAuth } from '../src/providers/AuthProvider'
import { UserMenu } from '../src/components/UserMenu'
import { getWeekStart } from '../src/utils/weekMath'

export default function HomeScreen() {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { token, isLoading: authLoading } = useAuth()
  const [activeType, setActiveType] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const { data: foodTypes = [] } = useQuery({
    queryKey: ['food-types'],
    queryFn: () => api.taxonomy.foodTypes(),
    enabled: !!token,
  })

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !token) {
      router.replace('/auth/login')
    }
  }, [token, authLoading, router])

  const {
    data: recipes = [],
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['recipes', query, activeType],
    queryFn: () =>
      getQueryFnKey(query) === 'search'
        ? api.recipes.search({ q: query, ...(activeType ? { tag: activeType } : {}) })
        : api.recipes.list({ limit: 50 }),
    placeholderData: (prev) => prev,
  })

  // Only show full-screen loader on first load, not on subsequent searches
  if (isLoading && recipes.length === 0)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  if (error)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error al cargar recetas</Text>
      </View>
    )

  return (
    <View style={styles.container}>
      {/* Fixed header — never scrolls */}
      <View style={styles.header}>
        <Text style={styles.title}>Recetario</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            placeholder="Buscar recetas..."
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          {isFetching && <ActivityIndicator size="small" style={styles.searchSpinner} />}
        </View>
        {foodTypes.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            <TouchableOpacity
              style={[styles.filterChip, activeType === null && styles.filterChipActive]}
              onPress={() => setActiveType(null)}
            >
              <Text
                style={[styles.filterChipText, activeType === null && styles.filterChipTextActive]}
              >
                Todas
              </Text>
            </TouchableOpacity>
            {foodTypes.slice(0, 8).map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.filterChip, activeType === t.id && styles.filterChipActive]}
                onPress={() => setActiveType(activeType === t.id ? null : t.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeType === t.id && styles.filterChipTextActive,
                  ]}
                >
                  {t.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/recipe/new')}>
            <Text style={styles.addButtonText}>+ Nueva Receta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/menu')}>
            <Text style={styles.menuButtonText}>Menú Semanal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() =>
              router.push({
                pathname: '/menu/shopping-list',
                params: { weekStart: getWeekStart(new Date()) },
              } as never)
            }
          >
            <Text style={styles.menuButtonText}>🛒 Compras</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.collectionsButton}
            onPress={() => router.push('/collections')}
          >
            <Text style={styles.collectionsButtonText}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileButton} onPress={() => setMenuOpen(true)}>
            <Text style={styles.profileButtonText}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable recipe list — takes remaining space */}
      <UserMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      <FlatList
        style={styles.list}
        data={recipes}
        keyExtractor={(item: Recipe) => item.id ?? item.title}
        renderItem={({ item }: { item: Recipe }) => (
          <TouchableOpacity
            testID={`recipe-card-${item.id}`}
            style={styles.card}
            onPress={() => router.push(`/recipe/${item.id}`)}
          >
            <Text testID={`recipe-title-${item.id}`} style={styles.cardTitle}>
              {item.title}
            </Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  list: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  searchSpinner: { marginLeft: 8 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
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
  filterScroll: { marginBottom: 4 },
  filterRow: { gap: 6, paddingHorizontal: 2 },
  filterChip: {
    paddingHorizontal: 12,
    height: 30,
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  collectionsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionsButtonText: { fontSize: 18 },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButtonText: { fontSize: 18 },
  card: { padding: 16, borderRadius: 8, backgroundColor: '#f9f9f9', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardMeta: { color: '#666', marginTop: 4 },
  tags: { color: '#999', fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  error: { color: 'red' },
})
