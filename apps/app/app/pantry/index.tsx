import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import { notify } from '../../src/utils/platformAlert'
import { expiryStatus, groupPantry, type PantryItem } from '../../src/utils/pantryView'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

export default function PantryScreen() {
  const c = useThemeColors()
  const s = makeStyles(c)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')

  const {
    data: items = [],
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ['pantry'], queryFn: () => api.pantry.list() })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pantry'] })

  const add = useMutation({
    mutationFn: (name: string) => api.pantry.create({ name, inStock: true }),
    onSuccess: () => {
      setNewName('')
      void invalidate()
    },
    onError: /* istanbul ignore next */ () => notify('Error', 'No se pudo agregar el ítem.'),
  })

  const toggle = useMutation({
    mutationFn: ({ id, inStock }: { id: string; inStock: boolean }) =>
      api.pantry.update(id, { inStock }),
    onSuccess: () => void invalidate(),
    onError: /* istanbul ignore next */ () => notify('Error', 'No se pudo actualizar el ítem.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.pantry.remove(id),
    onSuccess: () => void invalidate(),
    onError: /* istanbul ignore next */ () => notify('Error', 'No se pudo eliminar el ítem.'),
  })

  if (isLoading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  if (error)
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Error al cargar la despensa</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => void refetch()}>
          <Text style={s.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )

  const { inStock, outOfStock } = groupPantry(items)
  const sections = [
    { key: 'in', title: 'En casa', data: inStock },
    { key: 'out', title: 'Se acabó', data: outOfStock },
  ].filter((sec) => sec.data.length > 0)
  const today = new Date()

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.title}>Despensa</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backLink}>‹ Volver</Text>
        </TouchableOpacity>
      </View>

      <View style={s.addRow}>
        <TextInput
          testID="pantry-new-name"
          style={s.addInput}
          placeholder="Agregar a la despensa…"
          placeholderTextColor={c.inkSoft}
          value={newName}
          onChangeText={setNewName}
          autoCorrect={false}
        />
        <TouchableOpacity
          testID="pantry-add"
          style={[s.addBtn, !newName.trim() && s.addBtnDisabled]}
          disabled={!newName.trim()}
          onPress={() => add.mutate(newName.trim())}
        >
          <Text style={s.addBtnText}>Agregar</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item: PantryItem) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.list}
        renderSectionHeader={({ section }) => <Text style={s.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }: { item: PantryItem }) => {
          const status = expiryStatus(item.expiryDate, today)
          return (
            <View testID={`pantry-item-${item.id}`} style={s.row}>
              <TouchableOpacity
                testID={`pantry-toggle-${item.id}`}
                style={[s.checkbox, item.inStock && s.checkboxOn]}
                onPress={() => toggle.mutate({ id: item.id, inStock: !item.inStock })}
              >
                {item.inStock && <Text style={s.checkmark}>✓</Text>}
              </TouchableOpacity>
              <View style={s.itemMain}>
                <Text style={[s.name, !item.inStock && s.nameOut]}>{item.name}</Text>
                {(item.quantity || status) && (
                  <View style={s.metaRow}>
                    {item.quantity ? (
                      <Text style={s.qty}>
                        {item.quantity}
                        {item.unit ? ` ${item.unit}` : ''}
                      </Text>
                    ) : null}
                    {status ? (
                      <Text
                        testID={`pantry-expiry-${item.id}`}
                        style={[
                          s.badge,
                          status === 'vencido'
                            ? s.badgeExpired
                            : status === 'pronto'
                              ? s.badgeSoon
                              : s.badgeOk,
                        ]}
                      >
                        {status === 'vencido'
                          ? 'Vencido'
                          : status === 'pronto'
                            ? 'Vence pronto'
                            : `Vence ${item.expiryDate}`}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
              <TouchableOpacity
                testID={`pantry-delete-${item.id}`}
                onPress={() => remove.mutate(item.id)}
              >
                <Text style={s.delete}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )
        }}
        ListEmptyComponent={
          <Text style={s.empty}>
            Tu despensa está vacía. Agregá lo que tenés en casa para que la lista de compras sepa
            qué saltear.
          </Text>
        }
      />
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    errorText: { color: c.danger },
    retryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: c.terracotta,
      borderRadius: 8,
    },
    retryText: { color: c.surface, fontWeight: '600' },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.line,
    },
    title: { fontSize: 22, fontWeight: '700', fontFamily: fonts.display, color: c.ink },
    backLink: { color: c.terracotta, fontWeight: '600' },
    addRow: { flexDirection: 'row', gap: 8, padding: 12 },
    addInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 10,
      fontSize: 15,
      backgroundColor: c.surface,
      color: c.ink,
    },
    addBtn: {
      paddingHorizontal: 16,
      justifyContent: 'center',
      backgroundColor: c.terracotta,
      borderRadius: 8,
    },
    addBtnDisabled: { opacity: 0.5 },
    addBtnText: { color: c.terracottaInk, fontWeight: '700' },
    list: { paddingHorizontal: 12, paddingBottom: 32 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.terracotta,
      fontFamily: fonts.display,
      marginTop: 16,
      marginBottom: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingVertical: 8,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.sand,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.line,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    checkboxOn: { backgroundColor: c.sage, borderColor: c.sage },
    checkmark: { color: c.surface, fontSize: 16, fontWeight: '900', lineHeight: 18 },
    itemMain: { flex: 1 },
    name: { fontSize: 15, color: c.ink },
    nameOut: { color: c.inkSoft, textDecorationLine: 'line-through' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    qty: { fontSize: 12, color: c.inkSoft },
    badge: {
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: 'hidden',
    },
    badgeExpired: { backgroundColor: c.dangerSoft, color: c.danger },
    badgeSoon: { backgroundColor: c.terracottaSoft, color: c.terracotta },
    badgeOk: { backgroundColor: c.sageSoft, color: c.sage },
    delete: { fontSize: 16, paddingHorizontal: 4 },
    empty: { textAlign: 'center', color: c.inkSoft, marginTop: 40, paddingHorizontal: 24 },
  })
