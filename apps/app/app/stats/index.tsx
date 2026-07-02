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

export default function StatsScreen() {
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

  const maxCount = Math.max(...(stats?.frequencyByWeek.map((w) => w.count) ?? [1]), 1)

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Total sessions */}
      <View style={s.totalCard}>
        <Text style={s.totalNum}>{stats?.totalSessions ?? 0}</Text>
        <Text style={s.totalLabel}>sesiones de cocina en total</Text>
      </View>

      {/* Top recipes */}
      <Text style={s.sectionTitle}>Recetas más cocinadas</Text>
      {(stats?.topRecipes ?? []).length === 0 ? (
        <Text style={s.empty}>¡Empezá a cocinar para ver tus recetas más usadas acá!</Text>
      ) : (
        stats?.topRecipes.map((r, i) => (
          <TouchableOpacity
            key={r.recipeId}
            style={s.topRow}
            onPress={() => router.push(`/recipe/${r.recipeId}`)}
          >
            <Text style={s.topRank}>#{i + 1}</Text>
            <View style={s.topInfo}>
              <Text style={s.topRecipeId} numberOfLines={1}>
                {r.recipeId.slice(0, 8)}…
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
          </TouchableOpacity>
        ))
      )}

      {/* Frequency chart */}
      <Text style={s.sectionTitle}>Frecuencia semanal</Text>
      {(stats?.frequencyByWeek ?? []).length === 0 ? (
        <Text style={s.empty}>Todavía no hay sesiones de cocina registradas.</Text>
      ) : (
        <View style={s.chart}>
          {stats?.frequencyByWeek.map((w) => (
            <View key={w.week} style={s.barGroup}>
              <Text style={s.barCount}>{w.count}</Text>
              <View style={[s.bar, { height: Math.max(4, (w.count / maxCount) * 80) }]} />
              <Text style={s.barWeek}>
                {new Date(w.week).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  totalCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  totalNum: { fontSize: 52, fontWeight: '800', color: '#2563eb' },
  totalLabel: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
  },
  empty: { color: '#9ca3af', fontSize: 14, marginBottom: 20 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    gap: 12,
  },
  topRank: { fontSize: 16, fontWeight: '700', color: '#9ca3af', width: 28 },
  topInfo: { flex: 1 },
  topRecipeId: { fontSize: 15, fontWeight: '600', color: '#111827' },
  topLastCooked: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  topCountBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  topCount: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120, paddingBottom: 20 },
  barGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barCount: { fontSize: 10, color: '#6b7280', marginBottom: 2 },
  bar: { width: '80%', backgroundColor: '#2563eb', borderRadius: 4, minHeight: 4 },
  barWeek: { fontSize: 9, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
})
