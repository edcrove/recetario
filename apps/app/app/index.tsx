import { useState } from 'react'
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
import { macroStrip } from '../src/utils/macroStrip'
import { getEmptyMessage, getQueryFnKey } from '../src/utils/homeScreen'
import { useAuth } from '../src/providers/AuthProvider'
import { UserMenu } from '../src/components/UserMenu'
import { getWeekStart } from '../src/utils/weekMath'
import { useThemeColors, fonts, type ThemeColors } from '../src/theme/tokens'

export default function HomeScreen() {
  const colors = useThemeColors()
  const styles = makeStyles(colors)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { token } = useAuth()
  const [activeType, setActiveType] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const { data: foodTypes = [] } = useQuery({
    queryKey: ['food-types'],
    queryFn: () => api.taxonomy.foodTypes(),
    enabled: !!token,
  })

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
        <View style={styles.titleRow}>
          <Text style={styles.title}>Recetario</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              testID="home-collections-button"
              style={styles.iconButton}
              onPress={() => router.push('/collections')}
            >
              <Text style={styles.iconButtonText}>📋</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="home-profile-button"
              style={styles.iconButton}
              onPress={() => setMenuOpen(true)}
            >
              <Text style={styles.iconButtonText}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            placeholderTextColor={colors.inkSoft}
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
            {macroStrip(item.nutrition) ? (
              <Text style={styles.cardMacros}>{macroStrip(item.nutrition)}</Text>
            ) : null}
            {item.tags.length > 0 && <Text style={styles.tags}>{item.tags.join(', ')}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{getEmptyMessage(query, recipes)}</Text>}
      />
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.paper },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.line,
      backgroundColor: c.surface,
    },
    list: { flex: 1, paddingHorizontal: 16 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: c.ink,
      fontFamily: fonts.display,
    },
    headerIcons: { flexDirection: 'row', gap: 8 },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.sand,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconButtonText: { fontSize: 18, color: c.ink },
    searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    search: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 10,
      fontSize: 16,
      backgroundColor: c.surface,
      color: c.ink,
    },
    searchSpinner: { marginLeft: 8 },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
      marginBottom: 8,
    },
    addButton: {
      flexBasis: '100%',
      paddingVertical: 12,
      backgroundColor: c.terracotta,
      borderRadius: 10,
      alignItems: 'center',
    },
    addButtonText: { color: c.terracottaInk, fontWeight: '700', fontSize: 15 },
    menuButton: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 130,
      paddingVertical: 11,
      backgroundColor: c.sage,
      borderRadius: 10,
      alignItems: 'center',
    },
    menuButtonText: { color: c.surface, fontWeight: '700' },
    filterScroll: { marginBottom: 4 },
    filterRow: { gap: 6, paddingHorizontal: 2 },
    filterChip: {
      paddingHorizontal: 12,
      height: 30,
      justifyContent: 'center',
      borderRadius: 15,
      backgroundColor: c.sand,
      borderWidth: 1,
      borderColor: c.line,
    },
    filterChipActive: { backgroundColor: c.terracotta, borderColor: c.terracotta },
    filterChipText: { fontSize: 13, color: c.inkSoft, fontWeight: '600' },
    filterChipTextActive: { color: c.terracottaInk, fontWeight: '700' },
    card: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: c.surface,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.line,
    },
    cardTitle: { fontSize: 18, fontWeight: '600', color: c.ink, fontFamily: fonts.display },
    cardMeta: { color: c.inkSoft, marginTop: 4 },
    cardMacros: { color: c.sage, marginTop: 3, fontSize: 12, fontVariant: ['tabular-nums'] },
    tags: { color: c.inkSoft, fontSize: 12, marginTop: 4 },
    empty: { textAlign: 'center', color: c.inkSoft, marginTop: 40 },
    error: { color: c.danger },
  })
