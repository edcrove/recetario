import {
  View,
  Text,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import type { ShoppingListEntry } from '@recetario/shared'
import { formatShoppingQty } from '../../src/utils/menuLogic'
import { groupShoppingByAisle, shoppingProgress } from '../../src/utils/shoppingSections'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

export default function ShoppingListScreen() {
  const colors = useThemeColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { weekStart } = useLocalSearchParams<{ weekStart: string }>()
  const week = weekStart ?? ''
  const queryKey = ['shopping-list', week]

  const {
    data: items = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => api.menu.shoppingList(week),
    enabled: !!weekStart,
  })

  const toggle = useMutation({
    mutationFn: ({ key, checked }: { key: string; checked: boolean }) =>
      api.menu.setShoppingCheck(week, key, checked),
    // Optimistic: flip the item(s) with this key immediately, roll back on error.
    onMutate: async ({ key, checked }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ShoppingListEntry[]>(queryKey)
      queryClient.setQueryData<ShoppingListEntry[]>(queryKey, (old) =>
        (old ?? []).map((i) => (i.key === key ? { ...i, checked } : i)),
      )
      return { previous }
    },
    onError: (_e, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
  })

  if (isLoading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  if (error)
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error al cargar la lista</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )

  const sections = groupShoppingByAisle(items)
  const { checked, total } = shoppingProgress(items)
  const pct = total > 0 ? checked / total : 0

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Lista de Compras</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>‹ Menú</Text>
        </TouchableOpacity>
      </View>

      {weekStart && <Text style={styles.weekLabel}>Semana del {weekStart}</Text>}

      {total > 0 && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${pct * 100}%` }]} />
          </View>
          <Text testID="shopping-progress" style={styles.progressLabel}>
            {checked} / {total}
          </Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item: ShoppingListEntry, i) => `${item.key}-${i}`}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>
              {section.checkedCount}/{section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }: { item: ShoppingListEntry }) => (
          <TouchableOpacity
            testID={`shopping-item-${item.key}`}
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => toggle.mutate({ key: item.key, checked: !item.checked })}
          >
            <View style={[styles.checkbox, item.checked && styles.checkboxOn]}>
              {item.checked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.name, item.checked && styles.nameChecked]}>{item.ingredient}</Text>
            <Text style={[styles.qty, item.checked && styles.qtyChecked]}>
              {formatShoppingQty(item)}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay ingredientes para esta semana</Text>}
        contentContainerStyle={styles.list}
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
    title: { fontSize: 20, fontWeight: '700', fontFamily: fonts.display, color: c.ink },
    backLink: { color: c.terracotta, fontWeight: '600' },
    weekLabel: {
      paddingHorizontal: 16,
      paddingTop: 8,
      color: c.inkSoft,
      fontSize: 13,
      fontFamily: fonts.display,
    },
    progressWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    progressBarTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.sand,
      overflow: 'hidden',
    },
    progressBarFill: { height: 8, borderRadius: 4, backgroundColor: c.sage },
    progressLabel: {
      color: c.inkSoft,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    list: { padding: 12, paddingBottom: 32 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 4,
      paddingTop: 18,
      paddingBottom: 6,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.terracotta,
      fontFamily: fonts.display,
    },
    sectionCount: { fontSize: 12, color: c.inkSoft, fontVariant: ['tabular-nums'] },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: c.sand,
      gap: 12,
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
    name: { fontSize: 15, flex: 1, color: c.ink },
    nameChecked: { color: c.inkSoft, textDecorationLine: 'line-through' },
    qty: { fontSize: 14, color: c.inkSoft, marginLeft: 12 },
    qtyChecked: { color: c.inkSoft, textDecorationLine: 'line-through' },
    empty: { textAlign: 'center', color: c.inkSoft, marginTop: 40 },
  })
