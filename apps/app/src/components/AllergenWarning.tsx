import { View, Text, StyleSheet } from 'react-native'
import { useProfile } from '../hooks/useProfile'
import { allergenLabel, type Recipe } from '@recetario/shared'
import { checkAllergens, DIETARY_LABELS } from '../utils/allergenCheck'
import { useThemeColors, type ThemeColors } from '../theme/tokens'

interface Props {
  recipe: Recipe
  ownerId?: string
}

export function AllergenWarning({ recipe }: Props) {
  const s = makeStyles(useThemeColors())
  const { data: profile } = useProfile()

  if (!profile) return null

  const { matchedAllergens, unmetDietary, unverifiedDietary } = checkAllergens(recipe, profile)
  // Matching is by ingredient name, so a recipe with no match is not proof it
  // is safe: anyone with allergies always sees the caveat.
  const hasAllergies = (profile.allergens ?? []).length > 0

  if (matchedAllergens.length + unmetDietary.length + unverifiedDietary.length === 0) {
    if (!hasAllergies) return null
    return (
      <Text testID="allergen-disclaimer" style={s.note}>
        No encontramos tus alérgenos en los nombres de los ingredientes. Es una detección
        automática: verificá la etiqueta de cada producto.
      </Text>
    )
  }

  return (
    <View testID="allergen-warning" style={s.container}>
      {matchedAllergens.length > 0 && (
        <View style={s.row}>
          <Text style={s.icon}>⚠️</Text>
          <Text style={s.text}>
            <Text style={s.bold}>Alérgenos: </Text>
            {matchedAllergens.map(allergenLabel).join(', ')}
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
      {unverifiedDietary.length > 0 && (
        <View style={s.row}>
          <Text style={s.icon}>ℹ️</Text>
          <Text style={s.text}>
            <Text style={s.bold}>Sin verificar: </Text>
            {unverifiedDietary.map((d) => DIETARY_LABELS[d] ?? d).join(', ')} (la receta no lo
            indica)
          </Text>
        </View>
      )}
      {hasAllergies && (
        <Text testID="allergen-disclaimer" style={s.caveat}>
          Detección automática por nombre: verificá la etiqueta de cada producto.
        </Text>
      )}
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: c.warningSoft,
      borderLeftWidth: 3,
      borderLeftColor: c.warning,
      borderRadius: 8,
      padding: 10,
      marginVertical: 8,
      gap: 4,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    icon: { fontSize: 14 },
    text: { flex: 1, fontSize: 13, color: c.warningInk, lineHeight: 18 },
    bold: { fontWeight: '700' },
    caveat: { fontSize: 12, color: c.warningInk, fontStyle: 'italic', marginTop: 2 },
    note: { fontSize: 12, color: c.inkSoft, fontStyle: 'italic', marginVertical: 8 },
  })
