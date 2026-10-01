import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../src/api/client'
import {
  chartWeeks,
  streakLabel,
  topRecipeLabel,
  statsWindowLabel,
  weekLabel,
} from '../../src/utils/statsLabels'
import { getWeekStart } from '../../src/utils/weekMath'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

export default function StatsScreen() {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const router = useRouter()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['cook-stats'],
    queryFn: () => api.cookSessions.stats(),
  })

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  const weeks = chartWeeks(stats?.frequencyByWeek ?? [], getWeekStart(new Date()))
  const maxCount = Math.max(...weeks.map((w) => w.count), 1)
  const streak = stats?.streak ?? { current: 0, longest: 0 }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Total sessions */}
      <View style={s.totalCard}>
        <Text style={s.totalNum}>{stats?.totalSessions ?? 0}</Text>
        <Text style={s.totalLabel}>
          sesiones de cocina{stats?.since ? ` ${statsWindowLabel(stats.since)}` : ''}
        </Text>
      </View>

      {/* Cooking streak */}
      <View testID="stats-streak" style={s.streakCard}>
        {streak.current > 0 ? (
          <Text style={s.streakNum}>🔥 {streakLabel(streak.current)} cocinando</Text>
        ) : (
          <Text style={s.streakNum}>Cociná hoy para empezar una racha</Text>
        )}
        {streak.longest > 0 && (
          <Text testID="stats-streak-longest" style={s.streakBest}>
            Mejor racha: {streakLabel(streak.longest)}
          </Text>
        )}
      </View>

      {/* Top recipes */}
      <Text style={s.sectionTitle}>Recetas más cocinadas</Text>
      {(stats?.topRecipes ?? []).length === 0 ? (
        <Text style={s.empty}>¡Empezá a cocinar para ver tus recetas más usadas acá!</Text>
      ) : (
        stats?.topRecipes.map((r, i) => {
          const recipeId = r.recipeId
          const content = (
            <>
              <Text style={s.topRank}>#{i + 1}</Text>
              <View style={s.topInfo}>
                <Text style={s.topRecipeId} numberOfLines={1}>
                  {topRecipeLabel(r)}
                </Text>
                <Text style={s.topLastCooked}>
                  Última vez:{' '}
                  {new Date(r.lastCookedAt).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
              <View style={s.topCountBadge}>
                <Text style={s.topCount}>{r.count}×</Text>
              </View>
            </>
          )
          return recipeId ? (
            <TouchableOpacity
              key={recipeId}
              style={s.topRow}
              onPress={() => router.push(`/recipe/${recipeId}`)}
            >
              {content}
            </TouchableOpacity>
          ) : (
            <View key={`deleted-${i}`} style={s.topRow}>
              {content}
            </View>
          )
        })
      )}

      {/* Frequency chart */}
      <Text style={s.sectionTitle}>Frecuencia semanal</Text>
      {(stats?.frequencyByWeek ?? []).length === 0 ? (
        <Text style={s.empty}>Todavía no hay sesiones de cocina registradas.</Text>
      ) : (
        <View style={s.chart}>
          {weeks.map((w) => (
            <View key={w.week} testID={`stats-week-${w.week}`} style={s.barGroup}>
              <Text style={s.barCount}>{w.count}</Text>
              <View style={[s.bar, { height: Math.max(4, (w.count / maxCount) * 80) }]} />
              <Text style={s.barWeek}>{weekLabel(w.week)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    content: { padding: 20, paddingBottom: 40 },
    center: { flex: 1, backgroundColor: c.paper, justifyContent: 'center', alignItems: 'center' },
    streakCard: {
      backgroundColor: c.sand,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      marginBottom: 24,
    },
    streakNum: { fontSize: 18, fontWeight: '700', color: c.ink, fontFamily: fonts.display },
    streakBest: { fontSize: 13, color: c.inkSoft, marginTop: 4 },
    totalCard: {
      backgroundColor: c.terracottaSoft,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 24,
    },
    totalNum: { fontSize: 52, fontWeight: '800', color: c.terracotta },
    totalLabel: { fontSize: 14, color: c.inkSoft, marginTop: 4 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.ink,
      marginBottom: 12,
      marginTop: 8,
      fontFamily: fonts.display,
    },
    empty: { color: c.inkSoft, fontSize: 14, marginBottom: 20 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: c.sand,
      gap: 12,
    },
    topRank: { fontSize: 16, fontWeight: '700', color: c.inkSoft, width: 28 },
    topInfo: { flex: 1 },
    topRecipeId: { fontSize: 15, fontWeight: '600', color: c.ink },
    topLastCooked: { fontSize: 12, color: c.inkSoft, marginTop: 1 },
    topCountBadge: {
      backgroundColor: c.terracottaSoft,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    topCount: { color: c.terracotta, fontWeight: '700', fontSize: 14 },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120, paddingBottom: 20 },
    barGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    barCount: { fontSize: 10, color: c.inkSoft, marginBottom: 2 },
    bar: { width: '80%', backgroundColor: c.terracotta, borderRadius: 4, minHeight: 4 },
    barWeek: { fontSize: 9, color: c.inkSoft, marginTop: 4, textAlign: 'center' },
  })
