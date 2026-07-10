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
import { useThemeColors, type ThemeColors } from '../theme/tokens'

interface Props {
  selected: string[]
  onChange: (ids: string[]) => void
  maxSelect?: number
}

export function FoodTypePicker({ selected, onChange, maxSelect = 3 }: Props) {
  const colors = useThemeColors()
  const s = makeStyles(colors)
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
            testID={`food-type-chip-${t.id}`}
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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    scroll: { marginBottom: 8 },
    row: { gap: 8, paddingHorizontal: 2 },
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
  })
