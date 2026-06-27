import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateRecipeSchema } from '@recetario/shared'
import type { Category, Unit } from '@recetario/shared'
import { api } from '../../src/api/client'

const CATEGORIES: Category[] = ['Desayuno', 'Almuerzo', 'Cena', 'Postre', 'Snack', 'Bebida', 'Otro']

const UNITS: (Unit | '')[] = [
  '',
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'unit',
  'pinch',
  'slice',
  'clove',
]

interface IngredientRow {
  name: string
  quantity: string
  unit: string
  presentation: string
}

interface StepRow {
  text: string
}

interface FieldErrors {
  title?: string
  servings?: string
  category?: string
  ingredients?: string
  steps?: string
  general?: string
}

export default function NewRecipeScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [servings, setServings] = useState('4')
  const [category, setCategory] = useState<Category>('Cena')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { name: '', quantity: '', unit: '', presentation: '' },
  ])
  const [steps, setSteps] = useState<StepRow[]>([{ text: '' }])
  const [errors, setErrors] = useState<FieldErrors>({})

  const mutation = useMutation({
    mutationFn: api.recipes.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recipes'] })
      router.back()
    },
    onError: (err: Error) => {
      setErrors({ general: err.message })
    },
  })

  function validate(): boolean {
    const data = buildPayload()
    const result = CreateRecipeSchema.safeParse(data)
    if (!result.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const path = issue.path[0]
        if (path === 'title') fieldErrors.title = issue.message
        else if (path === 'servings') fieldErrors.servings = issue.message
        else if (path === 'category') fieldErrors.category = issue.message
        else if (path === 'ingredients') fieldErrors.ingredients = issue.message
        else fieldErrors.general = issue.message
      }
      setErrors(fieldErrors)
      return false
    }
    setErrors({})
    return true
  }

  function buildPayload() {
    return {
      title: title.trim(),
      servings: parseInt(servings, 10) || 0,
      category,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      notes: notes.trim() || undefined,
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          quantity: i.quantity ? parseFloat(i.quantity) : null,
          unit: (i.unit as Unit) || null,
          presentation: i.presentation.trim() || undefined,
        })),
      steps: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim() })),
    }
  }

  function handleSubmit() {
    if (!validate()) return
    mutation.mutate(buildPayload() as Parameters<typeof api.recipes.create>[0])
  }

  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)))
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { name: '', quantity: '', unit: '', presentation: '' }])
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { text: value } : s)))
  }

  function addStep() {
    setSteps((prev) => [...prev, { text: '' }])
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.heading}>Nueva Receta</Text>

      {/* Title */}
      <Text style={st.label}>Título *</Text>
      <TextInput
        style={[st.input, errors.title ? st.inputError : null]}
        value={title}
        onChangeText={setTitle}
        placeholder="Nombre de la receta"
      />
      {errors.title ? <Text style={st.errorText}>{errors.title}</Text> : null}

      {/* Servings */}
      <Text style={st.label}>Porciones *</Text>
      <TextInput
        style={[st.input, errors.servings ? st.inputError : null]}
        value={servings}
        onChangeText={setServings}
        keyboardType="numeric"
        placeholder="4"
      />
      {errors.servings ? <Text style={st.errorText}>{errors.servings}</Text> : null}

      {/* Category */}
      <Text style={st.label}>Categoría *</Text>
      <View style={st.categoryRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[st.catBtn, category === cat && st.catBtnActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[st.catBtnText, category === cat && st.catBtnTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tags */}
      <Text style={st.label}>Etiquetas (separadas por coma)</Text>
      <TextInput
        style={st.input}
        value={tags}
        onChangeText={setTags}
        placeholder="italiana, pasta, rápida"
      />

      {/* Ingredients */}
      <Text style={st.sectionTitle}>Ingredientes *</Text>
      {errors.ingredients ? <Text style={st.errorText}>{errors.ingredients}</Text> : null}
      {ingredients.map((ing, i) => (
        <View key={i} style={st.ingRow}>
          <TextInput
            style={[st.input, st.ingName]}
            value={ing.name}
            onChangeText={(v) => updateIngredient(i, 'name', v)}
            placeholder="Ingrediente"
          />
          <TextInput
            style={[st.input, st.ingQty]}
            value={ing.quantity}
            onChangeText={(v) => updateIngredient(i, 'quantity', v)}
            keyboardType="numeric"
            placeholder="Cant."
          />
          <View style={st.unitPickerWrap}>
            {UNITS.slice(0, 6).map((u) => (
              <TouchableOpacity
                key={u || '__none__'}
                style={[st.unitBtn, ing.unit === u && st.unitBtnActive]}
                onPress={() => updateIngredient(i, 'unit', u)}
              >
                <Text style={[st.unitBtnText, ing.unit === u && st.unitBtnTextActive]}>
                  {u || '—'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[st.input, st.ingPresentation]}
            value={ing.presentation}
            onChangeText={(v) => updateIngredient(i, 'presentation', v)}
            placeholder="Picado, etc."
          />
          {ingredients.length > 1 && (
            <TouchableOpacity onPress={() => removeIngredient(i)}>
              <Text style={st.removeBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity style={st.addRow} onPress={addIngredient}>
        <Text style={st.addRowText}>+ Agregar ingrediente</Text>
      </TouchableOpacity>

      {/* Steps */}
      <Text style={st.sectionTitle}>Pasos de preparación</Text>
      {steps.map((step, i) => (
        <View key={i} style={st.stepRow}>
          <Text style={st.stepNum}>{i + 1}.</Text>
          <TextInput
            style={[st.input, st.stepInput]}
            value={step.text}
            onChangeText={(v) => updateStep(i, v)}
            placeholder={`Paso ${i + 1}`}
            multiline
          />
          {steps.length > 1 && (
            <TouchableOpacity onPress={() => removeStep(i)}>
              <Text style={st.removeBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity style={st.addRow} onPress={addStep}>
        <Text style={st.addRowText}>+ Agregar paso</Text>
      </TouchableOpacity>

      {/* Notes */}
      <Text style={st.label}>Notas</Text>
      <TextInput
        style={[st.input, { height: 80 }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Consejos, variaciones, etc."
        multiline
      />

      {errors.general ? <Text style={st.errorText}>{errors.general}</Text> : null}

      <TouchableOpacity
        style={[st.saveBtn, mutation.isPending && st.saveBtnDisabled]}
        onPress={handleSubmit}
        disabled={mutation.isPending}
      >
        <Text style={st.saveBtnText}>{mutation.isPending ? 'Guardando...' : 'Guardar Receta'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#333', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  catBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#eee',
    marginBottom: 4,
  },
  catBtnActive: { backgroundColor: '#2563eb' },
  catBtnText: { color: '#333', fontSize: 13 },
  catBtnTextActive: { color: '#fff' },
  ingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  ingName: { flex: 2 },
  ingQty: { flex: 1 },
  ingPresentation: { flex: 1 },
  unitPickerWrap: { flexDirection: 'row', gap: 4 },
  unitBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  unitBtnActive: { backgroundColor: '#2563eb' },
  unitBtnText: { fontSize: 11, color: '#555' },
  unitBtnTextActive: { color: '#fff' },
  addRow: { paddingVertical: 8 },
  addRowText: { color: '#2563eb', fontWeight: '600' },
  removeBtn: { color: '#ef4444', fontSize: 18, paddingHorizontal: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 6 },
  stepNum: { fontWeight: 'bold', color: '#2563eb', paddingTop: 10, width: 20 },
  stepInput: { flex: 1 },
  saveBtn: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
