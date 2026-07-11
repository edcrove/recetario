import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../src/api/client'
import { displayIngredient } from '../../src/utils/displayIngredient'
import type { DisplayMode } from '../../src/utils/displayIngredient'
import { roundNutrition, scaleNutrition } from '../../src/utils/nutritionDisplay'
import { AllergenWarning } from '../../src/components/AllergenWarning'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'
import { isForeignRecipe } from '../../src/utils/roles'
import { sourceHost } from '../../src/utils/sourceHost'
import { useAuth } from '../../src/providers/AuthProvider'
import { NutritionBar } from '../../src/components/NutritionBar'

type DetailTab = 'recipe' | 'history'

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <Text style={ratingStyle.none}>Sin calificación</Text>
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
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const { userId } = useAuth()
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
  // Provenance: title of the recipe this one was forked from. The source may
  // be private to another user (the fork is a snapshot), so a 404 is normal —
  // the chip then falls back to a generic label.
  const { data: forkSource } = useQuery({
    queryKey: ['recipe', recipe?.forkedFromId],
    queryFn: () => api.recipes.get(recipe!.forkedFromId!),
    enabled: !!recipe?.forkedFromId,
    retry: false,
  })
  const forkSourceTitle = forkSource?.title

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
        {!isForeignRecipe(recipe.ownerId, userId) && (
          <TouchableOpacity onPress={() => router.push(`/recipe/${id}/edit`)}>
            <Text style={s.editLink}>Editar</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.meta}>
        {recipe.category}
        {recipe.totalTimeMin ? ` · ${recipe.totalTimeMin} min` : ''}
      </Text>

      {recipe.source?.url ? (
        <TouchableOpacity
          testID="recipe-source"
          onPress={() => void Linking.openURL(recipe.source!.url!)}
        >
          <Text style={s.sourceLink}>Fuente: {sourceHost(recipe.source.url)}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Allergen warning */}
      {recipe.forkedFromId && (
        <View testID="fork-provenance" style={s.forkChip}>
          <Text style={s.forkChipText}>
            🍴 Copiada de {forkSourceTitle ?? 'la biblioteca'} — tus cambios no afectan la original.
          </Text>
        </View>
      )}

      <AllergenWarning recipe={recipe} />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['recipe', 'history'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            testID={`recipe-tab-${t}`}
            style={[s.tabBtn, detailTab === t && s.tabBtnActive]}
            onPress={() => setDetailTab(t)}
          >
            <Text style={[s.tabBtnText, detailTab === t && s.tabBtnTextActive]}>
              {t === 'recipe'
                ? 'Receta'
                : `Historial${sessions.length > 0 ? ` (${sessions.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {detailTab === 'history' && (
        <View>
          {sessions.length === 0 ? (
            <Text style={s.emptyHistory}>Todavía no cocinaste esta receta.</Text>
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
            <>
              <NutritionBar label="Nutrición por porción" {...roundNutrition(recipe.nutrition)} />
              <NutritionBar
                label="Nutrición por cantidad de porciones"
                {...roundNutrition(scaleNutrition(recipe.nutrition, current))}
              />
            </>
          )}

          {/* Steps */}
          {recipe.steps.length > 0 && (
            <>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Preparación</Text>
                <TouchableOpacity
                  testID="recipe-detail-cook"
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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    forkChip: {
      backgroundColor: c.sageSoft,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 10,
    },
    forkChipText: { color: c.sage, fontSize: 12.5, fontWeight: '600' },
    container: { flex: 1, backgroundColor: c.surface },
    content: { padding: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
      flex: 1,
      fontFamily: fonts.display,
      color: c.ink,
    },
    editLink: { color: c.terracotta, fontSize: 16, paddingLeft: 8 },
    meta: { color: c.inkSoft, marginBottom: 6 },
    sourceLink: { color: c.terracotta, fontSize: 13, marginBottom: 16, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    label: { fontSize: 16, color: c.ink },
    btn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.sand,
      justifyContent: 'center',
      alignItems: 'center',
    },
    btnText: { fontSize: 20, color: c.ink },
    servings: { fontSize: 20, minWidth: 32, textAlign: 'center', color: c.ink },
    toggle: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.sand,
    },
    toggleActive: { backgroundColor: c.terracotta },
    toggleText: { color: c.ink },
    toggleTextActive: { color: c.surface },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      marginBottom: 8,
    },
    sectionTitle: { fontSize: 18, fontWeight: '600', fontFamily: fonts.display, color: c.ink },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderColor: c.sand,
      marginVertical: 12,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabBtnActive: { borderBottomColor: c.terracotta },
    tabBtnText: { fontSize: 14, fontWeight: '600', color: c.inkSoft },
    tabBtnTextActive: { color: c.terracotta },
    emptyHistory: { color: c.inkSoft, textAlign: 'center', marginTop: 24, fontSize: 14 },
    relatedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: c.sand,
      gap: 10,
    },
    relatedLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: c.terracotta,
      backgroundColor: c.terracottaSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    relatedId: { flex: 1, fontSize: 13, color: c.ink },
    chevron: { fontSize: 18, color: c.inkSoft },
    sessionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: c.sand,
    },
    sessionLeft: { flex: 1, marginRight: 12 },
    sessionDate: { fontSize: 14, fontWeight: '600', color: c.ink },
    sessionNote: { fontSize: 13, color: c.inkSoft, marginTop: 2 },
    cookBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: c.sage,
      borderRadius: 8,
    },
    cookBtnText: { color: c.surface, fontWeight: '600', fontSize: 13 },
    ingredient: { fontSize: 15, marginBottom: 4, paddingLeft: 4, color: c.ink },
    step: { flexDirection: 'row', marginBottom: 12, gap: 8 },
    stepNum: { fontWeight: 'bold', color: c.terracotta, width: 24 },
    stepText: { flex: 1, fontSize: 15, lineHeight: 22, color: c.ink },
    notes: { fontSize: 14, color: c.inkSoft, lineHeight: 20 },
    error: { color: c.danger },
  })
