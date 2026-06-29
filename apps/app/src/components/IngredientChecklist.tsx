import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import type { Ingredient } from '@recetario/shared'
import { formatIngredient } from '../utils/ingredientFormat'

interface Props {
  ingredients: Ingredient[]
  baseServings: number
  targetServings: number
}

export function IngredientChecklist({ ingredients, baseServings, targetServings }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {ingredients.map((ing, i) => {
        const done = checked.has(i)
        return (
          <TouchableOpacity key={i} style={s.row} onPress={() => toggle(i)} activeOpacity={0.7}>
            <View style={[s.checkbox, done && s.checkboxChecked]}>
              {done && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={[s.label, done && s.labelDone]}>
              {formatIngredient(ing, baseServings, targetServings)}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  label: { flex: 1, fontSize: 16, color: '#111827', lineHeight: 24 },
  labelDone: { color: '#9ca3af', textDecorationLine: 'line-through' },
})
