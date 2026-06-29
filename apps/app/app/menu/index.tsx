import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import type { MenuEntry, MenuSlot } from '@recetario/shared'
import { getWeekStart, addDays, formatDate } from '../../src/utils/weekMath'

const SLOTS: MenuSlot[] = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros']

export default function MenuWeekScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))

  const {
    data: entries = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['menu', weekStart],
    queryFn: () => api.menu.getWeek(weekStart),
  })

  const removeMutation = useMutation({
    mutationFn: ({ date, slot }: { date: string; slot: string }) => api.menu.remove(date, slot),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['menu', weekStart] })
    },
  })

  const entryMap = new Map<string, MenuEntry>()
  for (const entry of entries) {
    entryMap.set(`${entry.date}::${entry.slot}`, entry)
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const prevWeek = () => setWeekStart(addDays(weekStart, -7))
  const nextWeek = () => setWeekStart(addDays(weekStart, 7))

  if (isLoading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )

  if (error)
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error al cargar el menú</Text>
      </View>
    )

  return (
    <ScrollView style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹ Anterior</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{formatDate(weekStart)}</Text>
        <TouchableOpacity onPress={nextWeek} style={styles.navBtn}>
          <Text style={styles.navBtnText}>Siguiente ›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.shoppingBtn}
        onPress={() => router.push({ pathname: '/menu/shopping-list', params: { weekStart } })}
      >
        <Text style={styles.shoppingBtnText}>Lista de compras</Text>
      </TouchableOpacity>

      {days.map((day) => (
        <View key={day} style={styles.dayCard}>
          <Text style={styles.dayTitle}>{formatDate(day)}</Text>
          {SLOTS.map((slot) => {
            const entry = entryMap.get(`${day}::${slot}`)
            return (
              <View key={slot} style={styles.slotRow}>
                <Text style={styles.slotLabel}>{slot}</Text>
                {entry ? (
                  <View style={styles.entryRow}>
                    <TouchableOpacity
                      style={styles.entryBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/menu/pick',
                          params: { date: day, slot, weekStart },
                        })
                      }
                    >
                      <Text style={styles.entryName} numberOfLines={1}>
                        {entry.recipeName ?? 'Receta'}
                      </Text>
                      <Text style={styles.entryServings}>{entry.servings} porc.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeMutation.mutate({ date: day, slot })}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addSlotBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/menu/pick',
                        params: { date: day, slot, weekStart },
                      })
                    }
                  >
                    <Text style={styles.addSlotText}>+ Agregar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#ef4444' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  navBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  navBtnText: { color: '#2563eb', fontWeight: '600' },
  weekLabel: { fontWeight: '600', fontSize: 15 },
  shoppingBtn: {
    margin: 12,
    padding: 12,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    alignItems: 'center',
  },
  shoppingBtnText: { color: '#fff', fontWeight: '600' },
  dayCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dayTitle: {
    backgroundColor: '#f3f4f6',
    padding: 10,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 8,
  },
  slotLabel: { width: 90, fontSize: 13, color: '#6b7280', flexShrink: 0 },
  entryRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryName: { flex: 1, fontSize: 14, fontWeight: '500' },
  entryServings: { fontSize: 12, color: '#9ca3af' },
  removeBtn: { padding: 4 },
  removeBtnText: { color: '#ef4444', fontWeight: '700' },
  addSlotBtn: { flex: 1 },
  addSlotText: { color: '#2563eb', fontSize: 14 },
})
