import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { UnitSchema } from '@recetario/shared'
import type { Category, CreateRecipe, RecipeDifficulty } from '@recetario/shared'
import {
  buildPayload,
  validatePayload,
  type IngredientRow,
  type StepRow,
  type FieldErrors,
  type RecipeFormState,
} from '../utils/recipeForm'
import { DIFFICULTIES } from '../utils/recipeMeta'
import { unitLabel } from '../utils/displayIngredient'
import { FoodTypePicker } from './FoodTypePicker'
import { confirmAsync } from '../utils/platformAlert'
import { useThemeColors, fonts, type ThemeColors } from '../theme/tokens'

const CATEGORIES: Category[] = ['Desayuno', 'Almuerzo', 'Cena', 'Postre', 'Snack', 'Bebida', 'Otro']
const UNIT_OPTIONS: string[] = ['', ...UnitSchema.options]
const EMPTY_INGREDIENT: IngredientRow = { name: '', quantity: '', unit: '', presentation: '' }

export const EMPTY_FORM: RecipeFormState = {
  title: '',
  servings: '4',
  category: 'Cena',
  tags: '',
  notes: '',
  ingredients: [EMPTY_INGREDIENT],
  steps: [{ text: '' }],
  prepTimeMin: '',
  cookTimeMin: '',
  difficulty: null,
  foodTypeIds: [],
  visibility: 'private',
}

interface Props {
  initial: RecipeFormState
  submitLabel: string
  isPending: boolean
  submitError?: string | undefined
  onSubmit: (payload: CreateRecipe) => void
}

/** Shared create/edit recipe form. Owns the form state; the screen owns the mutation. */
export function RecipeForm({ initial, submitLabel, isPending, submitError, onSubmit }: Props) {
  const colors = useThemeColors()
  const st = makeStyles(colors)

  const [title, setTitle] = useState(initial.title)
  const [servings, setServings] = useState(initial.servings)
  const [category, setCategory] = useState<Category>(initial.category)
  const [tags, setTags] = useState(initial.tags)
  const [notes, setNotes] = useState(initial.notes)
  const [foodTypeIds, setFoodTypeIds] = useState<string[]>(initial.foodTypeIds)
  const [ingredients, setIngredients] = useState<IngredientRow[]>(initial.ingredients)
  const [steps, setSteps] = useState<StepRow[]>(initial.steps)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [visibility, setVisibility] = useState(initial.visibility)
  const [prepTimeMin, setPrepTimeMin] = useState(initial.prepTimeMin)
  const [cookTimeMin, setCookTimeMin] = useState(initial.cookTimeMin)
  const [difficulty, setDifficulty] = useState<RecipeDifficulty | null>(initial.difficulty)
  const [openUnitRow, setOpenUnitRow] = useState<number | null>(null)

  function handleSubmit() {
    if (isPending) return
    const payload = buildPayload(
      title,
      servings,
      category,
      tags,
      notes,
      ingredients,
      steps,
      undefined,
      foodTypeIds,
      { prepTimeMin, cookTimeMin, difficulty },
    )
    const { valid, errors: fieldErrors } = validatePayload(payload)
    if (!valid) {
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    // Always send the selection so an edit can clear every food type.
    onSubmit({ ...payload, foodTypeIds, visibility } as CreateRecipe)
  }

  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)))
  }

  function pickUnit(index: number, unit: string) {
    updateIngredient(index, 'unit', unit)
    setOpenUnitRow(null)
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
    setOpenUnitRow(null)
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { text: value } : s)))
  }

  async function toggleVisibility() {
    if (visibility === 'private') {
      const confirmed = await confirmAsync(
        'Publicar en la biblioteca',
        'Cualquiera podrá ver esta receta y copiarla a su recetario. ¿Publicar?',
      )
      if (confirmed) setVisibility('public')
    } else {
      setVisibility('private')
    }
  }

  const generalError = errors.general ?? submitError

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      <Text style={st.label}>Título *</Text>
      <TextInput
        placeholderTextColor={colors.inkSoft}
        style={[st.input, errors.title ? st.inputError : null]}
        value={title}
        onChangeText={setTitle}
        placeholder="Nombre de la receta"
      />
      {errors.title ? <Text style={st.errorText}>{errors.title}</Text> : null}

      <Text style={st.label}>Porciones *</Text>
      <TextInput
        placeholderTextColor={colors.inkSoft}
        style={[st.input, errors.servings ? st.inputError : null]}
        value={servings}
        onChangeText={setServings}
        keyboardType="numeric"
        placeholder="4"
      />
      {errors.servings ? <Text style={st.errorText}>{errors.servings}</Text> : null}

      <Text style={st.label}>Categoría *</Text>
      <View style={st.chipRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[st.chip, category === cat && st.chipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[st.chipText, category === cat && st.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={st.label}>Tipo de comida (hasta 3)</Text>
      <FoodTypePicker selected={foodTypeIds} onChange={setFoodTypeIds} />

      <View style={st.timesRow}>
        <View style={st.timeCol}>
          <Text style={st.label}>Prep. (min)</Text>
          <TextInput
            testID="recipe-prep-time"
            placeholderTextColor={colors.inkSoft}
            style={st.input}
            value={prepTimeMin}
            onChangeText={setPrepTimeMin}
            keyboardType="numeric"
            placeholder="10"
          />
        </View>
        <View style={st.timeCol}>
          <Text style={st.label}>Cocción (min)</Text>
          <TextInput
            testID="recipe-cook-time"
            placeholderTextColor={colors.inkSoft}
            style={st.input}
            value={cookTimeMin}
            onChangeText={setCookTimeMin}
            keyboardType="numeric"
            placeholder="15"
          />
        </View>
      </View>
      <Text style={st.label}>Dificultad</Text>
      <View style={st.chipRow}>
        {DIFFICULTIES.map((d) => (
          <TouchableOpacity
            key={d}
            testID={`difficulty-chip-${d}`}
            style={[st.chip, difficulty === d && st.chipActive]}
            onPress={() => setDifficulty(difficulty === d ? null : d)}
          >
            <Text style={[st.chipText, difficulty === d && st.chipTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={st.label}>Visibilidad</Text>
      <TouchableOpacity
        testID="visibility-toggle"
        style={st.visRow}
        onPress={() => void toggleVisibility()}
      >
        <View style={[st.visPill, visibility === 'public' && st.visPillPublic]}>
          <Text style={[st.visPillText, visibility === 'public' && st.visPillTextPublic]}>
            {visibility === 'public' ? '🌐 Pública' : '🔒 Privada'}
          </Text>
        </View>
        <Text style={st.visHint}>
          {visibility === 'public'
            ? 'Visible en la biblioteca: cualquiera puede copiarla.'
            : 'Solo vos y tu hogar pueden verla.'}
        </Text>
      </TouchableOpacity>

      <Text style={st.label}>Etiquetas (separadas por coma)</Text>
      <TextInput
        placeholderTextColor={colors.inkSoft}
        style={st.input}
        value={tags}
        onChangeText={setTags}
        placeholder="italiana, pasta, rápida"
      />

      <Text style={st.sectionTitle}>Ingredientes *</Text>
      {errors.ingredients ? <Text style={st.errorText}>{errors.ingredients}</Text> : null}
      {ingredients.map((ing, i) => (
        <View key={i} style={st.ingBlock}>
          <View style={st.ingRow}>
            <TextInput
              placeholderTextColor={colors.inkSoft}
              style={[st.input, st.ingName]}
              value={ing.name}
              onChangeText={(v) => updateIngredient(i, 'name', v)}
              placeholder="Ingrediente"
            />
            {ingredients.length > 1 && (
              <TouchableOpacity
                testID={`ingredient-remove-${i}`}
                accessibilityLabel="Quitar ingrediente"
                onPress={() => removeIngredient(i)}
              >
                <Text style={st.removeBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={st.ingRow}>
            <TextInput
              placeholderTextColor={colors.inkSoft}
              style={[st.input, st.ingQty]}
              value={ing.quantity}
              onChangeText={(v) => updateIngredient(i, 'quantity', v)}
              keyboardType="numeric"
              placeholder="Cant."
            />
            <TouchableOpacity
              testID={`ingredient-unit-${i}`}
              accessibilityLabel="Unidad"
              style={st.unitToggle}
              onPress={() => setOpenUnitRow(openUnitRow === i ? null : i)}
            >
              <Text style={st.unitToggleText}>{ing.unit ? unitLabel(ing.unit) : 'unidad'} ▾</Text>
            </TouchableOpacity>
            <TextInput
              placeholderTextColor={colors.inkSoft}
              style={[st.input, st.ingPresentation]}
              value={ing.presentation}
              onChangeText={(v) => updateIngredient(i, 'presentation', v)}
              placeholder="Picado, etc."
            />
          </View>
          {openUnitRow === i && (
            <View style={st.chipRow}>
              {UNIT_OPTIONS.map((u) => (
                <TouchableOpacity
                  key={u || '__none__'}
                  testID={`unit-option-${i}-${u || 'none'}`}
                  style={[st.chip, ing.unit === u && st.chipActive]}
                  onPress={() => pickUnit(i, u)}
                >
                  <Text style={[st.chipText, ing.unit === u && st.chipTextActive]}>
                    {u ? unitLabel(u) : 'sin unidad'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}
      <TouchableOpacity
        style={st.addRow}
        onPress={() => setIngredients((prev) => [...prev, EMPTY_INGREDIENT])}
      >
        <Text style={st.addRowText}>+ Agregar ingrediente</Text>
      </TouchableOpacity>

      <Text style={st.sectionTitle}>Pasos de preparación</Text>
      {steps.map((step, i) => (
        <View key={i} style={st.stepRow}>
          <Text style={st.stepNum}>{i + 1}.</Text>
          <TextInput
            placeholderTextColor={colors.inkSoft}
            style={[st.input, st.stepInput]}
            value={step.text}
            onChangeText={(v) => updateStep(i, v)}
            placeholder={`Paso ${i + 1}`}
            multiline
          />
          {steps.length > 1 && (
            <TouchableOpacity onPress={() => setSteps((prev) => prev.filter((_, j) => j !== i))}>
              <Text style={st.removeBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity
        style={st.addRow}
        onPress={() => setSteps((prev) => [...prev, { text: '' }])}
      >
        <Text style={st.addRowText}>+ Agregar paso</Text>
      </TouchableOpacity>

      <Text style={st.label}>Notas</Text>
      <TextInput
        placeholderTextColor={colors.inkSoft}
        style={[st.input, { height: 80 }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Consejos, variaciones, etc."
        multiline
      />

      {generalError ? <Text style={st.errorText}>{generalError}</Text> : null}

      <TouchableOpacity
        testID="recipe-form-save"
        style={[st.saveBtn, isPending && st.saveBtnDisabled]}
        onPress={handleSubmit}
        disabled={isPending}
      >
        <Text style={st.saveBtnText}>{isPending ? 'Guardando...' : submitLabel}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    content: { padding: 16, paddingBottom: 40 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: c.ink, marginTop: 12 },
    input: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 10,
      fontSize: 15,
      backgroundColor: c.surface,
      color: c.ink,
    },
    inputError: { borderColor: c.danger },
    errorText: { color: c.danger, fontSize: 12, marginTop: 2 },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      marginTop: 20,
      marginBottom: 8,
      fontFamily: fonts.display,
      color: c.ink,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    timesRow: { flexDirection: 'row', gap: 12 },
    timeCol: { flex: 1 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.sand,
      marginBottom: 4,
    },
    chipActive: { backgroundColor: c.terracotta },
    chipText: { color: c.ink, fontSize: 13 },
    chipTextActive: { color: c.surface },
    // Each ingredient is two rows so it fits a 390px phone: name (+ remove),
    // then quantity · unit · presentation. The full unit list opens below.
    ingBlock: {
      marginBottom: 10,
      paddingBottom: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.line,
    },
    ingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
    ingName: { flex: 1 },
    ingQty: { width: 72 },
    ingPresentation: { flex: 1, minWidth: 0 },
    unitToggle: {
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.sand,
      minWidth: 72,
      alignItems: 'center',
    },
    unitToggleText: { fontSize: 13, color: c.ink },
    addRow: { paddingVertical: 8 },
    addRowText: { color: c.terracotta, fontWeight: '600' },
    removeBtn: { color: c.danger, fontSize: 18, paddingHorizontal: 4 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 6 },
    stepNum: { fontWeight: 'bold', color: c.terracotta, paddingTop: 10, width: 20 },
    stepInput: { flex: 1 },
    saveBtn: {
      marginTop: 24,
      backgroundColor: c.terracotta,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: c.surface, fontSize: 16, fontWeight: '700' },
    visRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    visPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.sand,
    },
    visPillPublic: { backgroundColor: c.terracotta },
    visPillText: { fontSize: 13, fontWeight: '600', color: c.ink },
    visPillTextPublic: { color: c.terracottaInk },
    visHint: { flex: 1, fontSize: 12, color: c.inkSoft },
  })
