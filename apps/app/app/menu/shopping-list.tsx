import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import type { ShoppingListItem } from '@recetario/shared'
import { formatShoppingQty } from '../../src/utils/menuLogic'

export default function ShoppingListScreen() {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { color: '#ef4444' },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 20, fontWeight: '700' },
  backLink: { color: '#2563eb', fontWeight: '600' },
  weekLabel: { paddingHorizontal: 16, paddingTop: 8, color: '#6b7280', fontSize: 13 },
  list: { padding: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  name: { fontSize: 15, flex: 1 },
  qty: { fontSize: 14, color: '#6b7280', marginLeft: 12 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
})
