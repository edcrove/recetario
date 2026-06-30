import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface Props {
  selected: string[]
  onChange: (ids: string[]) => void
  maxSelect?: number
}

export function FoodTypePicker({ selected, onChange, maxSelect = 3 }: Props) {
  const { data: types = [], isLoading } = useQuery({
    queryKey: ['food-types'],
    queryFn: () => api.taxonomy.foodTypes(),
  })

  if (isLoading) return <ActivityIndicator style={{ margin: 8 }} />

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else if (selected.length < maxSelect) {
      onChange([...selected, id])
    }
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.scroll}
      contentContainerStyle={s.row}
    >
      {types.map((t) => {
        const active = selected.includes(t.id)
        return (
          <TouchableOpacity
            key={t.id}
            style={[s.chip, active && s.chipActive]}
            onPress={() => toggle(t.id)}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{t.name}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { marginBottom: 8 },
  row: { gap: 8, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#2563eb', fontWeight: '600' },
})
