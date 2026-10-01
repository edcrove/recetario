import { View, Text, StyleSheet } from 'react-native'
import { useProfile } from '../hooks/useProfile'
import type { Recipe } from '@recetario/shared'
import { checkAllergens } from '../utils/allergenCheck'
import { useThemeColors } from '../theme/tokens'

interface Props {
  recipe: Pick<Recipe, 'ingredients' | 'dietaryTags'>
}

// Compact conflict indicator for list/picker contexts (menu/pick.tsx, the
// weekly menu grid) where the full AllergenWarning banner would be too heavy.
// Found during the 2026-07-03 audit (parent/family persona): the warning only
// showed up on the recipe detail page, three taps deep from where planning
// actually happens.
export function AllergenBadge({ recipe }: Props) {
  const c = useThemeColors()
  const { data: profile } = useProfile()

  if (!profile) return null

  const { matchedAllergens, unmetDietary } = checkAllergens(recipe, profile)
  if (matchedAllergens.length === 0 && unmetDietary.length === 0) return null

  return (
    <View testID="allergen-badge" style={[s.badge, { backgroundColor: c.warningSoft }]}>
      <Text style={s.icon}>{matchedAllergens.length > 0 ? '⚠️' : '🚫'}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: {
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 11 },
})
