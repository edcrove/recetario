import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../src/api/client'
import { displayIngredient } from '../../src/utils/displayIngredient'
import type { DisplayMode } from '../../src/utils/displayIngredient'
import { AllergenWarning } from '../../src/components/AllergenWarning'
import { NutritionBar } from '../../src/components/NutritionBar'

type DetailTab = 'recipe' | 'history'

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <Text style={ratingStyle.none}>No rating</Text>
  return (
    <Text style={ratingStyle.stars}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </Text>
  )
}

const ratingStyle = StyleSheet.create({
  stars: { color: '#f59e0b', fontSize: 14 },
  none: { color: '#d1d5db', fontSize: 13 },
})

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [targetServings, setTargetServings] = useState<number | null>(null)
  const [mode, setMode] = useState<DisplayMode>('cooking')
  const [detailTab, setDetailTab] = useState<DetailTab>('recipe')

  const {
    data: recipe,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipes.get(id),
  })

  // All hooks must be called before any conditional return
  const { data: sessions = [] } = useQuery({
    queryKey: ['cook-sessions', id],
    queryFn: () => api.cookSessions.listByRecipe(id),
    enabled: detailTab === 'history' && !!recipe,
  })

  const { data: relations = [] } = useQuery({
    queryKey: ['relations', id],
    queryFn: () => api.taxonomy.relations(id),
    enabled: detailTab === 'recipe' && !!recipe,
  })

  if (isLoading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  if (error || !recipe)
    return (
      <View style={s.center}>
        <Text style={s.error}>Receta no encontrada</Text>
      </View>
    )

  const base = recipe.servings
  const current = targetServings ?? base

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>{recipe.title}</Text>
        <TouchableOpacity onPress={() => router.push(`/recipe/${id}/edit`)}>
          <Text style={s.editLink}>Editar</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.meta}>
        {recipe.category}
        {recipe.totalTimeMin ? ` · ${recipe.totalTimeMin} min` : ''}
      </Text>

      {/* Allergen warning */}
      <AllergenWarning recipe={recipe} />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['recipe', 'history'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, detailTab === t && s.tabBtnActive]}
            onPress={() => setDetailTab(t)}
          >
            <Text style={[s.tabBtnText, detailTab === t && s.tabBtnTextActive]}>
              {t === 'recipe'
                ? 'Recipe'
                : `History${sessions.length > 0 ? ` (${sessions.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {detailTab === 'history' && (
        <View>
          {sessions.length === 0 ? (
            <Text style={s.emptyHistory}>You haven't cooked this recipe yet.</Text>
          ) : (
            sessions.map((session) => (
              <View key={session.id} style={s.sessionRow}>
                <View style={s.sessionLeft}>
                  <Text style={s.sessionDate}>
                    {new Date(session.cookedAt).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                  {session.notes ? <Text style={s.sessionNote}>{session.notes}</Text> : null}
                </View>
                <StarRating rating={session.rating} />
              </View>
            ))
          )}
        </View>
      )}

      {/* Servings stepper */}
      <View style={s.row}>
        <Text style={s.label}>Porciones:</Text>
        <TouchableOpacity style={s.btn} onPress={() => setTargetServings(Math.max(1, current - 1))}>
          <Text style={s.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.servings}>{current}</Text>
        <TouchableOpacity style={s.btn} onPress={() => setTargetServings(current + 1)}>
          <Text style={s.btnText}>+</Text>
        </TouchableOpacity>
      </View>

      {detailTab === 'recipe' && (
        <>
          {/* Unit toggle */}
          <View style={s.row}>
            {(['cooking', 'metric', 'imperial'] as DisplayMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.toggle, mode === m && s.toggleActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[s.toggleText, mode === m && s.toggleTextActive]}>
                  {m === 'cooking' ? 'Cocina' : m === 'metric' ? 'Métrico' : 'Imperial'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Ingredients */}
          <Text style={s.sectionTitle}>Ingredientes</Text>
          {recipe.ingredients.map((ing, i) => (
            <Text key={i} style={s.ingredient}>
              • {displayIngredient(ing, base, current, mode)}
            </Text>
          ))}

          {/* Nutrition */}
          {recipe.nutrition && (
            <NutritionBar
              label="Nutrición por porción"
              calories={Math.round((recipe.nutrition.calories ?? 0) * (current / base))}
              protein_g={Math.round((recipe.nutrition.protein_g ?? 0) * (current / base) * 10) / 10}
              carbs_g={Math.round((recipe.nutrition.carbs_g ?? 0) * (current / base) * 10) / 10}
              fat_g={Math.round((recipe.nutrition.fat_g ?? 0) * (current / base) * 10) / 10}
              fiber_g={
                recipe.nutrition.fiber_g != null
                  ? Math.round(recipe.nutrition.fiber_g * (current / base) * 10) / 10
                  : undefined
              }
            />
          )}

          {/* Steps */}
          {recipe.steps.length > 0 && (
            <>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Preparación</Text>
                <TouchableOpacity
                  style={s.cookBtn}
                  onPress={() => router.push(`/recipe/${id}/cook`)}
                >
                  <Text style={s.cookBtnText}>Iniciar cocina</Text>
                </TouchableOpacity>
              </View>
              {recipe.steps.map((step, i) => (
                <View key={i} style={s.step}>
                  <Text style={s.stepNum}>{i + 1}</Text>
                  <Text style={s.stepText}>{step.text}</Text>
                </View>
              ))}
            </>
          )}

          {recipe.notes && (
            <>
              <Text style={s.sectionTitle}>Notas</Text>
              <Text style={s.notes}>{recipe.notes}</Text>
            </>
          )}

          {relations.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Te puede gustar</Text>
              {relations.slice(0, 4).map((rel) => (
                <TouchableOpacity
                  key={rel.toId}
                  style={s.relatedRow}
                  onPress={() => router.push(`/recipe/${rel.toId}`)}
                >
                  <Text style={s.relatedLabel}>
                    {rel.relationType === 'variation'
                      ? 'Variación'
                      : rel.relationType === 'similar'
                        ? 'Similar'
                        : 'Inspiración'}
                  </Text>
                  <Text style={s.relatedId} numberOfLines={1}>
                    {rel.toId.slice(0, 8)}…
                  </Text>
                  <Text style={s.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4, flex: 1 },
  editLink: { color: '#2563eb', fontSize: 16, paddingLeft: 8 },
  meta: { color: '#666', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  label: { fontSize: 16 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: { fontSize: 20 },
  servings: { fontSize: 20, minWidth: 32, textAlign: 'center' },
  toggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#eee' },
  toggleActive: { backgroundColor: '#2563eb' },
  toggleText: { color: '#333' },
  toggleTextActive: { color: '#fff' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    marginVertical: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: '#2563eb' },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabBtnTextActive: { color: '#2563eb' },
  emptyHistory: { color: '#9ca3af', textAlign: 'center', marginTop: 24, fontSize: 14 },
  relatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    gap: 10,
  },
  relatedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  relatedId: { flex: 1, fontSize: 13, color: '#374151' },
  chevron: { fontSize: 18, color: '#9ca3af' },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  sessionLeft: { flex: 1, marginRight: 12 },
  sessionDate: { fontSize: 14, fontWeight: '600', color: '#374151' },
  sessionNote: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  cookBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#16a34a',
    borderRadius: 8,
  },
  cookBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  ingredient: { fontSize: 15, marginBottom: 4, paddingLeft: 4 },
  step: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  stepNum: { fontWeight: 'bold', color: '#2563eb', width: 24 },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22 },
  notes: { fontSize: 14, color: '#555', lineHeight: 20 },
  error: { color: 'red' },
})
