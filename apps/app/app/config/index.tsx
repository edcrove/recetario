import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../src/api/client'

type TabType = 'categories' | 'food-types' | 'tags'
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
}

export default function ConfiguratorScreen() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabType>('categories')
  const [editingItem, setEditingItem] = useState<TaxonomyItem | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TaxonomyItem | null>(null)
  const [reassignId, setReassignId] = useState('')

  const { data: taxonomy, isLoading } = useQuery({
    queryKey: ['config-taxonomy'],
    queryFn: () => api.config.taxonomy(),
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.config.rename(tab, id, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-taxonomy'] })
      setEditingItem(null)
    },
  })

  const deleteItem = useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
      api.config.delete(tab, id, reassignTo),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-taxonomy'] })
      setDeleteTarget(null)
      setReassignId('')
    },
    onError: () => Alert.alert('Error', 'Could not delete item.'),
  })

  const mergeTags = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      api.config.mergeTags(sourceId, targetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-taxonomy'] })
      setDeleteTarget(null)
      setReassignId('')
    },
  })

  const currentItems: TaxonomyItem[] =
    tab === 'categories'
      ? (taxonomy?.mealCategories ?? [])
      : tab === 'food-types'
        ? (taxonomy?.foodTypes ?? [])
        : (taxonomy?.tags ?? [])

  if (isLoading)
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
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>{TAB_LABELS[t]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items list */}
      <FlatList
        data={currentItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>No hay elementos en esta sección.</Text>}
        renderItem={({ item }) => (
          <View style={s.itemRow}>
            <View style={s.itemInfo}>
              <Text style={s.itemName}>{item.name}</Text>
              <View style={s.itemMeta}>
                <Text style={[s.badge, item.usageCount > 0 ? s.badgeUsed : s.badgeEmpty]}>
                  {item.usageCount} receta{item.usageCount !== 1 ? 's' : ''}
                </Text>
                {item.isSystem && <Text style={s.systemBadge}>Sistema</Text>}
              </View>
            </View>
            <View style={s.itemActions}>
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => {
                  setEditingItem(item)
                  setEditName(item.name)
                }}
              >
                <Text style={s.actionBtnText}>✏️</Text>
              </TouchableOpacity>
              {item.isDeletable && (
                <TouchableOpacity style={s.actionBtnDanger} onPress={() => setDeleteTarget(item)}>
                  <Text style={s.actionBtnText}>🗑️</Text>
                </TouchableOpacity>
              )}
              {!item.isDeletable && item.usageCount > 0 && (
                <TouchableOpacity style={s.actionBtnWarning} onPress={() => setDeleteTarget(item)}>
                  <Text style={s.actionBtnText}>⚠️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* Rename modal */}
      <Modal visible={!!editingItem} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Renombrar</Text>
            <TextInput
              style={s.modalInput}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              placeholder="Nuevo nombre"
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, !editName.trim() && s.modalBtnDisabled]}
                disabled={!editName.trim() || rename.isPending}
                onPress={() =>
                  editingItem && rename.mutate({ id: editingItem.id, name: editName.trim() })
                }
              >
                <Text style={s.modalBtnText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditingItem(null)}>
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
            <Text style={s.modalTitle}>
              {deleteTarget?.isDeletable
                ? 'Eliminar'
                : `"${deleteTarget?.name}" está en ${deleteTarget?.usageCount} receta(s)`}
            </Text>
            {!deleteTarget?.isDeletable && (
              <>
                <Text style={s.modalSubtitle}>Elige qué hacer:</Text>
                <Text style={s.modalLabel}>Reasignar a (ID del reemplazo):</Text>
                <TextInput
                  style={s.modalInput}
                  value={reassignId}
                  onChangeText={setReassignId}
                  placeholder="UUID del ítem destino"
                  autoCapitalize="none"
                />
              </>
            )}
            <View style={s.modalActions}>
              <TouchableOpacity
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
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabScroll: { borderBottomWidth: 1, borderColor: '#f3f4f6', flexGrow: 0 },
  tabRow: { flexDirection: 'row', padding: 12, gap: 8 },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  tabBtnActive: { backgroundColor: '#2563eb' },
  tabBtnText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabBtnTextActive: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, gap: 8 },
  empty: { color: '#9ca3af', textAlign: 'center', marginTop: 32 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemMeta: { flexDirection: 'row', gap: 6, marginTop: 3 },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeUsed: { backgroundColor: '#eff6ff', color: '#2563eb' },
  badgeEmpty: { backgroundColor: '#f3f4f6', color: '#9ca3af' },
  systemBadge: {
    fontSize: 11,
    color: '#9ca3af',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  itemActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { padding: 6, borderRadius: 6, backgroundColor: '#eff6ff' },
  actionBtnDanger: { padding: 6, borderRadius: 6, backgroundColor: '#fef2f2' },
  actionBtnWarning: { padding: 6, borderRadius: 6, backgroundColor: '#fffbeb' },
  actionBtnText: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  modalActions: { gap: 8 },
  modalBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalBtnDanger: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalBtnDisabled: { opacity: 0.4 },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: '#9ca3af', fontSize: 14 },
})
