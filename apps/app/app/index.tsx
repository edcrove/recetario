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
import { ErrorState } from '../src/components/ErrorState'
import { DIETARY_TAGS, type Recipe, type RecipeDifficulty } from '@recetario/shared'
import { macroStrip } from '../src/utils/macroStrip'
import {
  DIFFICULTIES,
  TIME_FILTERS,
  formatTimeDifficulty,
  filterByTimeDifficulty,
} from '../src/utils/recipeMeta'
import {
  getEmptyMessage,
  getQueryFnKey,
  homeSearchParams,
  isFirstRun,
} from '../src/utils/homeScreen'
import { DIETARY_LABELS } from '../src/utils/allergenCheck'
import { WelcomeCard } from '../src/components/WelcomeCard'
import { useAuth } from '../src/providers/AuthProvider'
import { UserMenu } from '../src/components/UserMenu'
import { getWeekStart } from '../src/utils/weekMath'
import { pendingInvitations } from '../src/utils/roles'
import { useThemeColors, fonts, type ThemeColors } from '../src/theme/tokens'

export default function HomeScreen() {
  const colors = useThemeColors()
  const styles = makeStyles(colors)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { token, userId } = useAuth()
  const [activeType, setActiveType] = useState<string | null>(null)
  const [dietary, setDietary] = useState<string | null>(null)
  const [maxTotalTime, setMaxTotalTime] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState<RecipeDifficulty | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const { data: foodTypes = [] } = useQuery({
    queryKey: ['food-types'],
    queryFn: () => api.taxonomy.foodTypes(),
    enabled: !!token,
  })

  const { data: households } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.households.mine(),
    enabled: !!token,
  })
  const invitations = pendingInvitations(households, userId)

  const {
    data: recipes = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['recipes', query, activeType, dietary],
    queryFn: () =>
      getQueryFnKey(query, activeType, dietary) === 'search'
        ? api.recipes.search(homeSearchParams(query, activeType, dietary))
        : api.recipes.list({ limit: 50 }),
    placeholderData: (prev) => prev,
  })

  const visibleRecipes = filterByTimeDifficulty(recipes, {
    ...(maxTotalTime != null && { maxTotalTime }),
    ...(difficulty != null && { difficulty }),
  })

  const hasActiveFilters =
    activeType != null || dietary != null || maxTotalTime != null || difficulty != null

  // Only show full-screen loader on first load, not on subsequent searches
  if (isLoading && recipes.length === 0)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  if (error) return <ErrorState message="Error al cargar recetas" onRetry={() => void refetch()} />

  return (
    <View style={styles.container}>
      {/* Fixed header — never scrolls */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Recetario</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              testID="home-collections-button"
              accessibilityRole="button"
              accessibilityLabel="Colecciones"
              style={styles.iconButton}
              onPress={() => router.push('/collections')}
            >
              <Text style={styles.iconButtonText}>📋</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="home-profile-button"
              accessibilityRole="button"
              accessibilityLabel="Mi perfil"
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
        {/* One row of 44pt actions; filters live in the list header and scroll away */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actions}
        >
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/recipe/new')}>
            <Text style={styles.addButtonText}>+ Nueva Receta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/menu')}>
            <Text style={styles.menuButtonText}>Menú Semanal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="home-heladera-button"
            style={styles.menuButton}
            onPress={() => router.push('/heladera')}
          >
            <Text style={styles.menuButtonText}>🧊 ¿Qué cocino?</Text>
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
        </ScrollView>
      </View>

      {invitations.length > 0 && (
        <TouchableOpacity
          testID="home-invitation-banner"
          style={styles.invitationBanner}
          onPress={() => router.push('/household')}
        >
          <Text style={styles.invitationText}>
            ✉️ Te invitaron a {invitations[0]!.name}
            {invitations.length > 1 ? ` y ${invitations.length - 1} hogar(es) más` : ''}. Tocá para
            aceptar o rechazar.
          </Text>
        </TouchableOpacity>
      )}

      {/* Scrollable recipe list — takes remaining space */}
      <UserMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      <FlatList
        style={styles.list}
        data={visibleRecipes}
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
            </Text>
            {formatTimeDifficulty(item) ? (
              <Text testID={`recipe-meta-${item.id}`} style={styles.cardTimeMeta}>
                {formatTimeDifficulty(item)}
              </Text>
            ) : null}
            {macroStrip(item.nutrition) ? (
              <Text style={styles.cardMacros}>{macroStrip(item.nutrition)}</Text>
            ) : null}
            {item.tags.length > 0 && <Text style={styles.tags}>{item.tags.join(', ')}</Text>}
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <View style={styles.filters}>
            {foodTypes.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterRow}
              >
                <TouchableOpacity
                  testID="home-type-chip-all"
                  style={[styles.filterChip, activeType === null && styles.filterChipActive]}
                  onPress={() => {
                    // "Todas" clears every filter, not just the food type
                    setActiveType(null)
                    setDietary(null)
                    setMaxTotalTime(null)
                    setDifficulty(null)
                  }}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      activeType === null && styles.filterChipTextActive,
                    ]}
                  >
                    Todas
                  </Text>
                </TouchableOpacity>
                {foodTypes.slice(0, 8).map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    testID={`home-type-chip-${t.id}`}
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
            {/* Diet combines with the food type (and the search text) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterRow}
            >
              {DIETARY_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  testID={`home-diet-chip-${tag}`}
                  aria-selected={dietary === tag}
                  style={[styles.filterChip, dietary === tag && styles.filterChipActive]}
                  onPress={() => setDietary(dietary === tag ? null : tag)}
                >
                  <Text
                    style={[styles.filterChipText, dietary === tag && styles.filterChipTextActive]}
                  >
                    {DIETARY_LABELS[tag]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterRow}
            >
              {TIME_FILTERS.map((tf) => (
                <TouchableOpacity
                  key={tf.maxTotalTime}
                  testID={`filter-time-${tf.maxTotalTime}`}
                  style={[
                    styles.filterChip,
                    maxTotalTime === tf.maxTotalTime && styles.filterChipActive,
                  ]}
                  onPress={() =>
                    setMaxTotalTime(maxTotalTime === tf.maxTotalTime ? null : tf.maxTotalTime)
                  }
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      maxTotalTime === tf.maxTotalTime && styles.filterChipTextActive,
                    ]}
                  >
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {DIFFICULTIES.map((d) => (
                <TouchableOpacity
                  key={d}
                  testID={`filter-difficulty-${d}`}
                  style={[styles.filterChip, difficulty === d && styles.filterChipActive]}
                  onPress={() => setDifficulty(difficulty === d ? null : d)}
                >
                  <Text
                    style={[styles.filterChipText, difficulty === d && styles.filterChipTextActive]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          isFirstRun(query, visibleRecipes, hasActiveFilters) ? (
            <WelcomeCard />
          ) : (
            <Text style={styles.empty}>
              {getEmptyMessage(query, visibleRecipes, hasActiveFilters)}
            </Text>
          )
        }
      />
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    invitationBanner: {
      backgroundColor: c.terracottaSoft,
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: 10,
      padding: 12,
    },
    invitationText: { color: c.ink, fontSize: 14, lineHeight: 20 },
    container: { flex: 1, backgroundColor: c.paper },
    center: { flex: 1, backgroundColor: c.paper, justifyContent: 'center', alignItems: 'center' },
    header: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: c.line,
      backgroundColor: c.surface,
    },
    list: { flex: 1, paddingHorizontal: 16 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: c.ink,
      fontFamily: fonts.display,
    },
    headerIcons: { flexDirection: 'row', gap: 8 },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
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
    actions: { gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
    addButton: {
      minHeight: 44,
      paddingHorizontal: 16,
      justifyContent: 'center',
      backgroundColor: c.terracotta,
      borderRadius: 10,
      alignItems: 'center',
    },
    addButtonText: { color: c.terracottaInk, fontWeight: '700', fontSize: 15 },
    menuButton: {
      minHeight: 44,
      paddingHorizontal: 14,
      justifyContent: 'center',
      backgroundColor: c.sage,
      borderRadius: 10,
      alignItems: 'center',
    },
    menuButtonText: { color: c.surface, fontWeight: '700' },
    filters: { paddingTop: 10, paddingBottom: 4 },
    filterScroll: { marginBottom: 6 },
    filterRow: { gap: 6, paddingHorizontal: 2 },
    filterChip: {
      paddingHorizontal: 14,
      minHeight: 36,
      justifyContent: 'center',
      borderRadius: 18,
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
    cardTimeMeta: {
      color: c.ink,
      marginTop: 3,
      fontSize: 13,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    cardMacros: { color: c.sage, marginTop: 3, fontSize: 12, fontVariant: ['tabular-nums'] },
    tags: { color: c.inkSoft, fontSize: 12, marginTop: 4 },
    empty: { textAlign: 'center', color: c.inkSoft, marginTop: 40 },
    error: { color: c.danger },
  })
