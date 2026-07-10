import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import type { MenuEntry, MenuSlot } from '@recetario/shared'
import { getWeekStart, addDays, formatDate } from '../../src/utils/weekMath'
import { buildEntryMap } from '../../src/utils/menuLogic'
import { notify } from '../../src/utils/platformAlert'
import { isViewerInAnyHousehold } from '../../src/utils/roles'
import { DayNutritionSummary } from '../../src/components/DayNutritionSummary'
import { useAuth } from '../../src/providers/AuthProvider'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

const SLOTS: MenuSlot[] = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros']

export default function MenuWeekScreen() {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  const { data: households } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.households.mine(),
  })
  // Viewers are read-only on the shared menu (the API 403s their writes) —
  // hide every mutation affordance so there are no dead buttons.
  const isViewer = isViewerInAnyHousehold(households, userId)
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [editing, setEditing] = useState<MenuEntry | null>(null)
  const [editServings, setEditServings] = useState(1)

  const {
    data: entries = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['menu', weekStart],
    queryFn: () => api.menu.getWeek(weekStart),
  })

  const removeMutation = useMutation({
    mutationFn: ({ date, slot, recipeId }: { date: string; slot: string; recipeId: string }) =>
      api.menu.remove(date, slot, recipeId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['menu', weekStart] }),
    onError: () => notify('Error', 'No se pudo quitar la receta del menú.'),
  })

  const updateServingsMutation = useMutation({
    mutationFn: ({
      date,
      slot,
      recipeId,
      servings,
    }: {
      date: string
      slot: string
      recipeId: string
      servings: number
    }) => api.menu.updateServings(date, slot, recipeId, servings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu', weekStart] })
      setEditing(null)
    },
    onError: () => notify('Error', 'No se pudieron actualizar las porciones.'),
  })

  const entryMap = buildEntryMap(entries)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function openEdit(entry: MenuEntry) {
    setEditing(entry)
    setEditServings(entry.servings)
  }

  if (isLoading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  if (error)
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Error al cargar el menú</Text>
      </View>
    )

  return (
    <ScrollView style={s.container}>
      {/* Week nav */}
      <View style={s.nav}>
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, -7))} style={s.navBtn}>
          <Text style={s.navBtnText}>‹ Anterior</Text>
        </TouchableOpacity>
        <Text testID="menu-week-label" style={s.weekLabel}>
          {formatDate(weekStart)}
        </Text>
        <TouchableOpacity onPress={() => setWeekStart(addDays(weekStart, 7))} style={s.navBtn}>
          <Text style={s.navBtnText}>Siguiente ›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={s.shoppingBtn}
        onPress={() =>
          router.push({ pathname: '/menu/shopping-list', params: { weekStart } } as never)
        }
      >
        <Text style={s.shoppingBtnText}>🛒 Lista de compras</Text>
      </TouchableOpacity>

      {days.map((day) => (
        <View key={day} style={s.dayCard}>
          <Text style={s.dayTitle}>{formatDate(day)}</Text>
          <DayNutritionSummary date={day} />
          {SLOTS.map((slot) => {
            const slotEntries = entryMap.get(`${day}::${slot}`) ?? []
            return (
              <View key={slot} style={s.slotRow}>
                <Text style={s.slotLabel}>{slot}</Text>
                <View style={s.slotContent}>
                  {slotEntries.map((entry, i) =>
                    entry.recipeId ? (
                      <View key={entry.recipeId} style={s.entryChip}>
                        <TouchableOpacity
                          testID={`menu-entry-${day}-${slot}-${entry.recipeId}`}
                          style={s.entryChipInner}
                          disabled={isViewer}
                          onPress={() => openEdit(entry)}
                        >
                          <Text style={s.entryName} numberOfLines={1}>
                            {entry.recipeName ?? 'Receta'}
                          </Text>
                          <Text style={s.entryServings}>{entry.servings} porc.</Text>
                        </TouchableOpacity>
                        {!isViewer && (
                          <TouchableOpacity
                            testID={`menu-remove-${day}-${slot}-${entry.recipeId}`}
                            style={s.removeChipBtn}
                            onPress={() =>
                              removeMutation.mutate({ date: day, slot, recipeId: entry.recipeId! })
                            }
                          >
                            <Text style={s.removeChipText}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      // Recipe was deleted since this entry was planned — show the
                      // title snapshot read-only instead of losing the entry.
                      <View key={`orphan-${i}`} style={[s.entryChip, s.entryChipOrphan]}>
                        <Text style={s.entryName} numberOfLines={1}>
                          {entry.recipeName ?? 'Receta eliminada'} (eliminada)
                        </Text>
                      </View>
                    ),
                  )}
                  {!isViewer && (
                    <TouchableOpacity
                      testID={`menu-add-${day}-${slot}`}
                      style={s.addSlotBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/menu/pick',
                          params: { date: day, slot, weekStart },
                        } as never)
                      }
                    >
                      <Text style={s.addSlotText}>+ Agregar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      ))}

      {/* Edit servings modal */}
      <Modal visible={editing !== null} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{editing?.recipeName ?? 'Receta'}</Text>
            <Text style={s.modalSub}>Porciones</Text>
            <View style={s.servingsRow}>
              <TouchableOpacity
                style={s.servingsBtn}
                onPress={() => setEditServings((v) => Math.max(1, v - 1))}
              >
                <Text style={s.servingsBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.servingsValue}>{editServings}</Text>
              <TouchableOpacity style={s.servingsBtn} onPress={() => setEditServings((v) => v + 1)}>
                <Text style={s.servingsBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={s.modalActions}>
              <TouchableOpacity
                testID="menu-modal-save"
                style={s.modalSaveBtn}
                disabled={updateServingsMutation.isPending}
                onPress={() => {
                  if (!editing?.recipeId) return
                  updateServingsMutation.mutate({
                    date: editing.date,
                    slot: editing.slot,
                    recipeId: editing.recipeId,
                    servings: editServings,
                  })
                }}
              >
                <Text style={s.modalSaveBtnText}>
                  {updateServingsMutation.isPending ? 'Guardando…' : 'Guardar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="menu-modal-delete"
                style={s.modalDeleteBtn}
                onPress={() => {
                  if (!editing?.recipeId) return
                  removeMutation.mutate({
                    date: editing.date,
                    slot: editing.slot,
                    recipeId: editing.recipeId,
                  })
                  setEditing(null)
                }}
              >
                <Text style={s.modalDeleteBtnText}>Eliminar del menú</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setEditing(null)}>
                <Text style={s.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: c.danger },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.line,
    },
    navBtn: { paddingVertical: 6, paddingHorizontal: 12 },
    navBtnText: { color: c.terracotta, fontWeight: '600' },
    weekLabel: { fontWeight: '600', fontSize: 15, fontFamily: fonts.display },
    shoppingBtn: {
      margin: 12,
      padding: 12,
      backgroundColor: c.sage,
      borderRadius: 8,
      alignItems: 'center',
    },
    shoppingBtnText: { color: c.surface, fontWeight: '600' },
    dayCard: {
      marginHorizontal: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      overflow: 'hidden',
    },
    dayTitle: {
      backgroundColor: c.sand,
      padding: 10,
      fontWeight: '700',
      fontSize: 14,
      textTransform: 'capitalize',
      fontFamily: fonts.display,
    },
    slotRow: {
      flexDirection: 'row',
      padding: 10,
      borderTopWidth: 1,
      borderTopColor: c.sand,
      gap: 8,
      alignItems: 'flex-start',
    },
    slotLabel: { width: 80, fontSize: 12, color: c.inkSoft, flexShrink: 0, paddingTop: 4 },
    slotContent: { flex: 1, gap: 4 },
    entryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.terracottaSoft,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.line,
      paddingLeft: 10,
      paddingVertical: 6,
      gap: 4,
    },
    entryChipOrphan: {
      backgroundColor: c.sand,
      borderColor: c.line,
      paddingVertical: 8,
      paddingRight: 10,
    },
    entryChipInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    entryName: { flex: 1, fontSize: 13, fontWeight: '600', color: c.terracotta },
    entryServings: { fontSize: 11, color: c.terracotta, fontWeight: '500' },
    removeChipBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    removeChipText: { color: c.danger, fontWeight: '700', fontSize: 12 },
    addSlotBtn: { paddingVertical: 4 },
    addSlotText: { color: c.terracotta, fontSize: 13 },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 360,
      gap: 12,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.ink, fontFamily: fonts.display },
    modalSub: { fontSize: 13, color: c.inkSoft },
    servingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
    servingsBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.sand,
      justifyContent: 'center',
      alignItems: 'center',
    },
    servingsBtnText: { fontSize: 22, color: c.ink },
    servingsValue: {
      fontSize: 28,
      fontWeight: '800',
      color: c.ink,
      minWidth: 40,
      textAlign: 'center',
    },
    modalActions: { gap: 8, marginTop: 4 },
    modalSaveBtn: {
      backgroundColor: c.terracotta,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    modalSaveBtnText: { color: c.surface, fontWeight: '700' },
    modalDeleteBtn: {
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    modalDeleteBtnText: { color: c.danger, fontWeight: '600' },
    modalCancelBtn: { paddingVertical: 10, alignItems: 'center' },
    modalCancelBtnText: { color: c.inkSoft },
  })
