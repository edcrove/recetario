import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Recipe } from '@recetario/shared'
import { checkAllergens, DIETARY_LABELS } from '../utils/allergenCheck'

interface Props {
  recipe: Recipe
  ownerId?: string
}

export function AllergenWarning({ recipe }: Props) {
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.auth.getProfile(),
  })

  if (!profile) return null

  const { matchedAllergens, unmetDietary } = checkAllergens(recipe, profile)

  if (matchedAllergens.length === 0 && unmetDietary.length === 0) return null

  return (
    <View style={s.container}>
      {matchedAllergens.length > 0 && (
        <View style={s.row}>
          <Text style={s.icon}>⚠️</Text>
          <Text style={s.text}>
            <Text style={s.bold}>Alérgenos: </Text>
            {matchedAllergens.join(', ')}
          </Text>
        </View>
      )}
      {unmetDietary.length > 0 && (
        <View style={s.row}>
          <Text style={s.icon}>🚫</Text>
          <Text style={s.text}>
            <Text style={s.bold}>No cumple: </Text>
            {unmetDietary.map((d) => DIETARY_LABELS[d] ?? d).join(', ')}
          </Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#fef9c3',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    gap: 4,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  icon: { fontSize: 14 },
  text: { flex: 1, fontSize: 13, color: '#78350f', lineHeight: 18 },
  bold: { fontWeight: '700' },
})
