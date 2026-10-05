import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ALLERGENS,
  ALLERGEN_LABELS,
  DIETARY_TAGS,
  allergenLabel,
  type DietaryTag,
  type HouseholdDiner,
} from '@recetario/shared'
import { api } from '../api/client'
import { DIETARY_LABELS } from '../utils/allergenCheck'
import { confirmAsync, notify } from '../utils/platformAlert'
import { useThemeColors, type ThemeColors } from '../theme/tokens'

interface Props {
  householdId: string
  diners: HouseholdDiner[]
  /** Viewers read the list but can't change it (the API 403s them). */
  canEdit: boolean
}

interface Draft {
  id: string | null
  name: string
  allergens: string[]
  dietaryRestrictions: DietaryTag[]
}

const toggle = <T extends string>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

const isDietaryTag = (r: string): r is DietaryTag => (DIETARY_TAGS as readonly string[]).includes(r)

/**
 * Who eats at this household's table, with or without an account (a kid, a
 * grandparent): their allergens and diets warn every member on recipes and
 * the menu. Story from Auditar 2026-10-03.
 */
export function HouseholdDiners({ householdId, diners, canEdit }: Props) {
  const s = makeStyles(useThemeColors())
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['households'] })

  const save = useMutation({
    mutationFn: ({ id, ...fields }: Draft) =>
      id
        ? api.households.updateDiner(householdId, id, fields)
        : api.households.addDiner(householdId, fields),
    onSuccess: () => {
      refresh()
      setDraft(null)
    },
    onError: () => notify('Error', 'No se pudo guardar. Probá de nuevo.'),
  })

  const remove = useMutation({
    mutationFn: (dinerId: string) => api.households.removeDiner(householdId, dinerId),
    onSuccess: refresh,
    onError: () => notify('Error', 'No se pudo quitar. Probá de nuevo.'),
  })

  const restrictions = (d: HouseholdDiner) =>
    [
      ...d.allergens.map(allergenLabel),
      ...d.dietaryRestrictions.map((r) => DIETARY_LABELS[r] ?? r),
    ].join(', ') || 'Sin restricciones'

  return (
    <View testID={`household-diners-${householdId}`}>
      <Text style={s.sectionLabel}>Quiénes comen acá</Text>
      <Text style={s.hint}>
        Sus alergias y dietas se avisan a todos los miembros en cada receta y en el menú, aunque no
        tengan cuenta.
      </Text>
      {diners.map((d) => (
        <View key={d.id} testID={`household-diner-${d.id}`} style={s.row}>
          <View style={s.info}>
            <Text style={s.name}>{d.name}</Text>
            <Text style={s.detail}>{restrictions(d)}</Text>
          </View>
          {canEdit && (
            <>
              <TouchableOpacity
                testID={`household-diner-edit-${d.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Editar a ${d.name}`}
                style={s.editBtn}
                onPress={() =>
                  setDraft({
                    id: d.id,
                    name: d.name,
                    allergens: d.allergens,
                    dietaryRestrictions: d.dietaryRestrictions.filter(isDietaryTag),
                  })
                }
              >
                <Text style={s.editText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`household-diner-remove-${d.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Quitar a ${d.name}`}
                disabled={remove.isPending}
                onPress={async () => {
                  const ok = await confirmAsync(
                    'Quitar',
                    `¿Quitar a ${d.name}? Sus alergias y dietas dejan de avisarse.`,
                  )
                  if (ok) remove.mutate(d.id)
                }}
              >
                <Text style={s.removeText}>✕</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}

      {canEdit &&
        (draft ? (
          <View style={s.form} testID="household-diner-form">
            <TextInput
              testID="household-diner-name"
              style={s.input}
              placeholder="Nombre (ej. Sofi)"
              placeholderTextColor={s.placeholder.color}
              value={draft.name}
              maxLength={60}
              onChangeText={(name) => setDraft({ ...draft, name })}
            />
            <Text style={s.formLabel}>Alergias</Text>
            <View style={s.chips}>
              {ALLERGENS.map((key) => {
                const active = draft.allergens.includes(key)
                return (
                  <TouchableOpacity
                    key={key}
                    testID={`household-diner-allergen-${key}`}
                    aria-selected={active}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setDraft({ ...draft, allergens: toggle(draft.allergens, key) })}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {ALLERGEN_LABELS[key]}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text style={s.formLabel}>Dietas</Text>
            <View style={s.chips}>
              {DIETARY_TAGS.map((tag) => {
                const active = draft.dietaryRestrictions.includes(tag)
                return (
                  <TouchableOpacity
                    key={tag}
                    testID={`household-diner-diet-${tag}`}
                    aria-selected={active}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        dietaryRestrictions: toggle(draft.dietaryRestrictions, tag),
                      })
                    }
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {DIETARY_LABELS[tag] ?? tag}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View style={s.actions}>
              <TouchableOpacity
                testID="household-diner-save"
                style={[s.btn, !draft.name.trim() && s.btnDisabled]}
                disabled={!draft.name.trim() || save.isPending}
                onPress={() => save.mutate({ ...draft, name: draft.name.trim() })}
              >
                <Text style={s.btnText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="household-diner-cancel" onPress={() => setDraft(null)}>
                <Text style={s.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            testID={`household-diner-add-${householdId}`}
            style={s.addBtn}
            onPress={() => setDraft({ id: null, name: '', allergens: [], dietaryRestrictions: [] })}
          >
            <Text style={s.addText}>+ Agregar a alguien (ej. un hijo)</Text>
          </TouchableOpacity>
        ))}
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 16,
      marginBottom: 4,
    },
    hint: { fontSize: 12, color: c.inkSoft, marginBottom: 8, lineHeight: 17 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
    info: { flex: 1 },
    name: { fontSize: 14, fontWeight: '600', color: c.ink },
    detail: { fontSize: 12, color: c.inkSoft },
    editBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: c.sand,
    },
    editText: { fontSize: 13, fontWeight: '600', color: c.ink },
    removeText: { color: c.danger, fontSize: 16, paddingHorizontal: 8 },
    form: { borderTopWidth: 1, borderColor: c.line, paddingTop: 12, marginTop: 8 },
    formLabel: { fontSize: 13, fontWeight: '600', color: c.ink, marginTop: 8, marginBottom: 6 },
    placeholder: { color: c.inkSoft },
    input: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      backgroundColor: c.surface,
      color: c.ink,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.sand,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: { backgroundColor: c.terracottaSoft, borderColor: c.terracotta },
    chipText: { fontSize: 13, color: c.inkSoft, fontWeight: '500' },
    chipTextActive: { color: c.terracotta, fontWeight: '600' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
    btn: {
      flex: 1,
      backgroundColor: c.terracotta,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: c.surface, fontWeight: '600', fontSize: 15 },
    cancelText: { color: c.inkSoft, fontSize: 14 },
    addBtn: { marginTop: 4, paddingVertical: 8, alignItems: 'center' },
    addText: { color: c.terracotta, fontWeight: '600', fontSize: 14 },
  })
