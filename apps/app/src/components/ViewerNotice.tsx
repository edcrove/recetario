import { View, Text, StyleSheet } from 'react-native'
import { useThemeColors, type ThemeColors } from '../theme/tokens'

/** Explains why editing controls are missing for a household viewer. */
export function ViewerNotice() {
  const c = useThemeColors()
  const s = makeStyles(c)
  return (
    <View testID="viewer-notice" style={s.box}>
      <Text style={s.text}>
        Tenés acceso de solo lectura en tu hogar: podés ver todo, pero no hacer cambios.
      </Text>
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    box: {
      marginHorizontal: 16,
      marginTop: 10,
      padding: 10,
      borderRadius: 8,
      backgroundColor: c.sand,
    },
    text: { color: c.ink, fontSize: 13 },
  })
