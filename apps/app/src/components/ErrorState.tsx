import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useThemeColors, type ThemeColors } from '../theme/tokens'

/** Full-screen load error with a retry, on the themed background. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const s = makeStyles(useThemeColors())
  return (
    <View style={s.center}>
      <Text style={s.text}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          testID="error-retry"
          accessibilityRole="button"
          style={s.btn}
          onPress={onRetry}
        >
          <Text style={s.btnText}>Reintentar</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    center: {
      flex: 1,
      backgroundColor: c.paper,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      gap: 12,
    },
    text: { color: c.danger, fontSize: 15, textAlign: 'center' },
    btn: {
      backgroundColor: c.terracotta,
      borderRadius: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    btnText: { color: c.terracottaInk, fontWeight: '700' },
  })
