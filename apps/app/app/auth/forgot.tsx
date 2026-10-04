import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

export default function ForgotPasswordScreen() {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const router = useRouter()

  // No email provider yet (decision log D-2026-09-30-11): be honest and send
  // people to whoever runs this Recetario (has the server and its reset script).
  return (
    <View style={s.container}>
      <View style={s.inner}>
        <Text style={s.icon}>🔑</Text>
        <Text style={s.title}>Restablecer contraseña</Text>
        <Text testID="forgot-explainer" style={s.body}>
          Todavía no enviamos emails. Pedile a quien administra Recetario (quien lo instaló) que te
          restablezca la contraseña: te va a pasar una contraseña temporal. Después cambiala en
          Perfil → Cambiar contraseña.
        </Text>
        <TouchableOpacity
          testID="forgot-back"
          style={s.btn}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={s.btnText}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
    icon: { fontSize: 48, textAlign: 'center', marginBottom: 16, color: c.ink },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: c.ink,
      marginBottom: 8,
      fontFamily: fonts.display,
    },
    body: { fontSize: 15, color: c.inkSoft, marginBottom: 28, lineHeight: 22 },
    btn: {
      backgroundColor: c.terracotta,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    btnText: { color: c.surface, fontSize: 16, fontWeight: '700' },
  })
