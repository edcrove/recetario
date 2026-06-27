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
import { scaleQuantity, convertUnit, convertWithDensity } from '@recetario/shared'
import type { Ingredient, Unit } from '@recetario/shared'

type DisplayMode = 'cooking' | 'metric' | 'imperial'

function formatQuantity(qty: number | null): string {
  if (qty === null) return 'c/n'
  if (qty === Math.floor(qty)) return String(qty)
  return qty.toFixed(2).replace(/\.?0+$/, '')
}

function displayIngredient(
  ing: Ingredient,
  baseServings: number,
  targetServings: number,
  mode: DisplayMode,
): string {
  const scaled = scaleQuantity(ing.quantity, baseServings, targetServings)

  // Unit toggle
  let finalQty = scaled
  let finalUnit = ing.unit

  if (scaled !== null && ing.unit) {
    if (mode === 'metric') {
      finalUnit = ing.unit && ['tsp', 'tbsp', 'cup'].includes(ing.unit) ? 'ml' : ing.unit
      finalQty = convertUnit(scaled, ing.unit, finalUnit)
    } else if (mode === 'imperial') {
      finalUnit = ing.unit === 'ml' ? 'tsp' : ing.unit === 'l' ? 'cup' : ing.unit
      finalQty = convertUnit(scaled, ing.unit, finalUnit)
    }
    // Try mass/volume conversion if density available
    finalQty = convertWithDensity(scaled, ing.unit as Unit, finalUnit as Unit, ing.name)
  }

  const qtyStr = formatQuantity(finalQty)
  const parts = [qtyStr, finalUnit, ing.presentation, ing.name].filter(Boolean)
  return parts.join(' ') + (ing.note ? ` (${ing.note})` : '')
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [targetServings, setTargetServings] = useState<number | null>(null)
  const [mode, setMode] = useState<DisplayMode>('cooking')

  const {
    data: recipe,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.recipes.get(id),
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

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Preparación</Text>
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
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  ingredient: { fontSize: 15, marginBottom: 4, paddingLeft: 4 },
  step: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  stepNum: { fontWeight: 'bold', color: '#2563eb', width: 24 },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22 },
  notes: { fontSize: 14, color: '#555', lineHeight: 20 },
  error: { color: 'red' },
})
