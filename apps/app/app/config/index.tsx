import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import {
  deleteModalTitle,
  newItemPlaceholder,
  createErrorAlert,
  usageBadgeLabel,
  usageModalTitle,
  type EditableTab,
} from '../../src/utils/configModal'
import { notify } from '../../src/utils/platformAlert'
import { IngredientsPanel } from '../../src/components/IngredientsPanel'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

type TabType = 'categories' | 'food-types' | 'tags' | 'ingredients'
type TaxonomyItem = {
  id: string
  name: string
  slug: string
  usageCount: number
  isDeletable: boolean
  isSystem?: boolean
}

const TAB_LABELS: Record<TabType, string> = {
  categories: 'Categorías',
  'food-types': 'Tipos de comida',
  tags: 'Etiquetas',
  ingredients: 'Ingredientes',
}

export default function ConfiguratorScreen() {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabType>('categories')
  const [editingItem, setEditingItem] = useState<TaxonomyItem | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyItem | null>(null)
  const [reassignId, setReassignId] = useState('')
  const [newName, setNewName] = useState('')
  const [usageItem, setUsageItem] = useState<TaxonomyItem | null>(null)
  const router = useRouter()

  const { data: taxonomy, isLoading } = useQuery({
    queryKey: ['config-taxonomy'],
    queryFn: () => api.config.taxonomy(),
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.config.rename(tab as Exclude<TabType, 'ingredients'>, id, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-taxonomy'] })
      setEditingItem(null)
    },
    onError: (err, { name }) => {
      const alert = createErrorAlert(err, name.trim(), 'renombrar')
      notify(alert.title, alert.message)
    },
  })

  const deleteItem = useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
      api.config.delete(tab as Exclude<TabType, 'ingredients'>, id, reassignTo),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-taxonomy'] })
      setDeleteTarget(null)
      setReassignId('')
    },
    onError: () => notify('Error', 'No se pudo eliminar el elemento.'),
  })

  const create = useMutation({
    mutationFn: (name: string) => api.config.create(tab as EditableTab, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-taxonomy'] })
      setNewName('')
    },
    onError: (err, name) => {
      const alert = createErrorAlert(err, name)
      notify(alert.title, alert.message)
    },
  })

  const usage = useQuery({
    queryKey: ['config-usage', tab, usageItem?.id],
    queryFn: () => api.config.usedBy(tab as EditableTab, usageItem!.id),
    enabled: !!usageItem,
  })

  const mergeTags = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      api.config.mergeTags(sourceId, targetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-taxonomy'] })
      setDeleteTarget(null)
      setReassignId('')
    },
    onError: () => notify('Error', 'No se pudieron unir las etiquetas.'),
  })

  const currentItems: TaxonomyItem[] =
    tab === 'categories'
      ? (taxonomy?.mealCategories ?? [])
      : tab === 'food-types'
        ? (taxonomy?.foodTypes ?? [])
        : (taxonomy?.tags ?? [])

  if (isLoading && tab !== 'ingredients')
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  return (
    <View style={s.container}>
      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabScroll}
        contentContainerStyle={s.tabRow}
      >
        {(Object.keys(TAB_LABELS) as TabType[]).map((t) => (
          <TouchableOpacity
            key={t}
            testID={`config-tab-${t}`}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>{TAB_LABELS[t]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'ingredients' ? (
        <IngredientsPanel />
      ) : (
        <>
          {/* Create a new item in this tab */}
          <View style={s.createRow}>
            <TextInput
              testID="config-new-name"
              placeholderTextColor={colors.inkSoft}
              style={s.createInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={newItemPlaceholder(tab)}
            />
            <TouchableOpacity
              testID="config-new-add"
              accessibilityRole="button"
              style={[s.createBtn, !newName.trim() && s.modalBtnDisabled]}
              disabled={!newName.trim() || create.isPending}
              onPress={() => create.mutate(newName.trim())}
            >
              <Text style={s.modalBtnText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {/* Items list */}
          <FlatList
            data={currentItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            ListEmptyComponent={<Text style={s.empty}>No hay elementos en esta sección.</Text>}
            renderItem={({ item }) => (
              <View style={s.itemRow} testID={`config-item-${item.id}`}>
                <View style={s.itemInfo}>
                  <Text style={s.itemName}>{item.name}</Text>
                  <View style={s.itemMeta}>
                    <TouchableOpacity
                      testID={`config-usage-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={usageBadgeLabel(item)}
                      disabled={item.usageCount === 0}
                      onPress={() => setUsageItem(item)}
                    >
                      <Text style={[s.badge, item.usageCount > 0 ? s.badgeUsed : s.badgeEmpty]}>
                        {item.usageCount} receta{item.usageCount !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                    {item.isSystem && <Text style={s.systemBadge}>Sistema</Text>}
                  </View>
                </View>
                <View style={s.itemActions}>
                  <TouchableOpacity
                    testID={`config-edit-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Renombrar"
                    style={s.actionBtn}
                    onPress={() => {
                      setEditingItem(item)
                      setEditName(item.name)
                    }}
                  >
                    <Text style={s.actionBtnText}>✏️</Text>
                  </TouchableOpacity>
                  {item.isDeletable && (
                    <TouchableOpacity
                      testID={`config-delete-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel="Eliminar"
                      style={s.actionBtnDanger}
                      onPress={() => setDeleteTarget(item)}
                    >
                      <Text style={s.actionBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                  {!item.isDeletable && item.usageCount > 0 && (
                    <TouchableOpacity
                      testID={`config-delete-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel="Eliminar o reasignar"
                      style={s.actionBtnWarning}
                      onPress={() => setDeleteTarget(item)}
                    >
                      <Text style={s.actionBtnText}>⚠️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          />

          {/* Recipes behind a usage badge */}
          <Modal visible={!!usageItem} transparent animationType="slide">
            <View style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>{usageModalTitle(usageItem)}</Text>
                {usage.isLoading ? (
                  <ActivityIndicator />
                ) : usage.isError ? (
                  <Text style={s.modalSubtitle}>No se pudieron cargar las recetas.</Text>
                ) : (
                  <ScrollView style={s.usageList}>
                    {(usage.data ?? []).map((r) => (
                      <TouchableOpacity
                        key={r.id}
                        testID={`config-usage-recipe-${r.id}`}
                        accessibilityRole="link"
                        style={s.usageRow}
                        onPress={() => {
                          setUsageItem(null)
                          router.push({ pathname: '/recipe/[id]', params: { id: r.id } })
                        }}
                      >
                        <Text style={s.usageRowText}>{r.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <TouchableOpacity
                  testID="config-usage-close"
                  style={s.cancelBtn}
                  onPress={() => setUsageItem(null)}
                >
                  <Text style={s.cancelBtnText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Rename modal */}
          <Modal visible={!!editingItem} transparent animationType="slide">
            <View style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Renombrar</Text>
                <TextInput
                  placeholderTextColor={colors.inkSoft}
                  style={s.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                  placeholder="Nuevo nombre"
                />
                <View style={s.modalActions}>
                  <TouchableOpacity
                    testID="config-rename-save"
                    style={[s.modalBtn, !editName.trim() && s.modalBtnDisabled]}
                    disabled={!editName.trim() || rename.isPending}
                    onPress={() =>
                      editingItem && rename.mutate({ id: editingItem.id, name: editName.trim() })
                    }
                  >
                    <Text style={s.modalBtnText}>Guardar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="config-rename-cancel"
                    style={s.cancelBtn}
                    onPress={() => setEditingItem(null)}
                  >
                    <Text style={s.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Delete / reassign modal */}
          <Modal visible={!!deleteTarget} transparent animationType="slide">
            <View style={s.modalOverlay}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>{deleteModalTitle(deleteTarget)}</Text>
                {!deleteTarget?.isDeletable && (
                  <>
                    <Text style={s.modalSubtitle}>Elige qué hacer:</Text>
                    <Text style={s.modalLabel}>Pasar sus recetas a (opcional):</Text>
                    <ScrollView style={s.reassignList} contentContainerStyle={s.reassignRow}>
                      {currentItems
                        .filter((it) => it.id !== deleteTarget?.id)
                        .map((it) => (
                          <TouchableOpacity
                            key={it.id}
                            testID={`config-reassign-${it.id}`}
                            style={[s.reassignChip, reassignId === it.id && s.reassignChipOn]}
                            onPress={() => setReassignId(reassignId === it.id ? '' : it.id)}
                          >
                            <Text
                              style={[
                                s.reassignChipText,
                                reassignId === it.id && s.reassignChipTextOn,
                              ]}
                            >
                              {it.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </>
                )}
                <View style={s.modalActions}>
                  <TouchableOpacity
                    testID="config-delete-confirm"
                    style={s.modalBtnDanger}
                    disabled={deleteItem.isPending || mergeTags.isPending}
                    onPress={() => {
                      if (!deleteTarget) return
                      if (tab === 'tags' && reassignId.trim()) {
                        mergeTags.mutate({ sourceId: deleteTarget.id, targetId: reassignId.trim() })
                      } else {
                        deleteItem.mutate({
                          id: deleteTarget.id,
                          reassignTo: reassignId.trim() || undefined,
                        })
                      }
                    }}
                  >
                    <Text style={s.modalBtnText}>
                      {reassignId.trim() ? 'Reasignar y eliminar' : 'Eliminar de todas las recetas'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="config-delete-cancel"
                    style={s.cancelBtn}
                    onPress={() => {
                      setDeleteTarget(null)
                      setReassignId('')
                    }}
                  >
                    <Text style={s.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    reassignList: { maxHeight: 160, marginBottom: 8 },
    reassignRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    reassignChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.sand,
    },
    reassignChipOn: { backgroundColor: c.terracotta },
    reassignChipText: { color: c.ink, fontSize: 13 },
    reassignChipTextOn: { color: c.terracottaInk, fontWeight: '700' },
    container: { flex: 1, backgroundColor: c.surface },
    center: { flex: 1, backgroundColor: c.paper, justifyContent: 'center', alignItems: 'center' },
    tabScroll: { borderBottomWidth: 1, borderColor: c.sand, flexGrow: 0 },
    tabRow: { flexDirection: 'row', padding: 12, gap: 8 },
    tabBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: c.sand,
    },
    tabBtnActive: { backgroundColor: c.terracotta },
    tabBtnText: { fontSize: 13, color: c.inkSoft, fontWeight: '500' },
    tabBtnTextActive: { color: c.surface, fontWeight: '600' },
    list: { padding: 16, gap: 8 },
    createRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
    createInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.ink,
      backgroundColor: c.surface,
    },
    createBtn: {
      backgroundColor: c.terracotta,
      borderRadius: 8,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    usageList: { maxHeight: 320, marginBottom: 8 },
    usageRow: { paddingVertical: 12, borderBottomWidth: 1, borderColor: c.sand },
    usageRowText: { fontSize: 15, color: c.ink },
    empty: { color: c.inkSoft, textAlign: 'center', marginTop: 32 },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 12,
    },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '600', color: c.ink },
    itemMeta: { flexDirection: 'row', gap: 6, marginTop: 3 },
    badge: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      color: c.ink,
    },
    badgeUsed: { backgroundColor: c.terracottaSoft, color: c.terracotta },
    badgeEmpty: { backgroundColor: c.sand, color: c.inkSoft },
    systemBadge: {
      fontSize: 11,
      color: c.inkSoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: c.sand,
      borderRadius: 8,
    },
    itemActions: { flexDirection: 'row', gap: 6 },
    actionBtn: { padding: 6, borderRadius: 6, backgroundColor: c.terracottaSoft },
    actionBtnDanger: { padding: 6, borderRadius: 6, backgroundColor: c.dangerSoft },
    actionBtnWarning: { padding: 6, borderRadius: 6, backgroundColor: c.warningSoft },
    actionBtnText: { fontSize: 14, color: c.ink },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 40,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.ink,
      marginBottom: 8,
      fontFamily: fonts.display,
    },
    modalSubtitle: { fontSize: 14, color: c.inkSoft, marginBottom: 12 },
    modalLabel: { fontSize: 13, fontWeight: '600', color: c.ink, marginBottom: 6 },
    modalInput: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      backgroundColor: c.surface,
      marginBottom: 16,
      color: c.ink,
    },
    modalActions: { gap: 8 },
    modalBtn: {
      backgroundColor: c.terracotta,
      borderRadius: 8,
      paddingVertical: 13,
      alignItems: 'center',
    },
    modalBtnDanger: {
      backgroundColor: c.danger,
      borderRadius: 8,
      paddingVertical: 13,
      alignItems: 'center',
    },
    modalBtnDisabled: { opacity: 0.4 },
    modalBtnText: { color: c.surface, fontWeight: '700', fontSize: 15 },
    cancelBtn: { alignItems: 'center', paddingVertical: 10 },
    cancelBtnText: { color: c.inkSoft, fontSize: 14 },
  })
