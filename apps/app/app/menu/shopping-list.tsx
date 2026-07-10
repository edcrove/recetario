import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import type { ShoppingListItem } from '@recetario/shared'
import { formatShoppingQty } from '../../src/utils/menuLogic'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

export default function ShoppingListScreen() {
  const colors = useThemeColors()
  const styles = makeStyles(colors)
  const router = useRouter()
  const { weekStart } = useLocalSearchParams<{ weekStart: string }>()

  const {
    data: items = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['shopping-list', weekStart],
    queryFn: () => api.menu.shoppingList(weekStart ?? ''),
    enabled: !!weekStart,
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

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Lista de Compras</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>‹ Menú</Text>
        </TouchableOpacity>
      </View>
      {weekStart && <Text style={styles.weekLabel}>Semana del {weekStart}</Text>}
      <FlatList
        data={items}
        keyExtractor={(item: ShoppingListItem, i) => `${item.ingredient}-${i}`}
        renderItem={({ item }: { item: ShoppingListItem }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.ingredient}</Text>
            <Text style={styles.qty}>{formatShoppingQty(item)}</Text>
          </View>
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
    title: { fontSize: 20, fontWeight: '700', fontFamily: fonts.display },
    backLink: { color: c.terracotta, fontWeight: '600' },
    weekLabel: {
      paddingHorizontal: 16,
      paddingTop: 8,
      color: c.inkSoft,
      fontSize: 13,
      fontFamily: fonts.display,
    },
    list: { padding: 12 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: c.sand,
    },
    name: { fontSize: 15, flex: 1 },
    qty: { fontSize: 14, color: c.inkSoft, marginLeft: 12 },
    empty: { textAlign: 'center', color: c.inkSoft, marginTop: 40 },
  })
