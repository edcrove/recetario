import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

export default function ForgotPasswordScreen() {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit() {
    if (!email.trim()) return
    // MVP: no real email sent — just show confirmation
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <View style={s.container}>
        <View style={s.inner}>
          <Text style={s.icon}>📧</Text>
          <Text style={s.title}>Revisá tu email</Text>
          <Text style={s.body}>
            Si <Text style={s.bold}>{email}</Text> está registrado, recibirás un link para
            restablecer tu contraseña en breve.
          </Text>
          <TouchableOpacity style={s.btn} onPress={() => router.push('/auth/login')}>
            <Text style={s.btnText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.inner}>
        <Text style={s.title}>Restablecer contraseña</Text>
        <Text style={s.body}>
          Ingresá tu email y te enviaremos un link para restablecer tu contraseña.
        </Text>

        <TextInput
          style={s.input}
          placeholder="vos@ejemplo.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <TouchableOpacity
          style={[s.btn, !email.trim() && s.btnDisabled]}
          onPress={handleSubmit}
          disabled={!email.trim()}
        >
          <Text style={s.btnText}>Enviar link</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => router.back()}>
          <Text style={s.linkText}>← Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
    icon: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: c.ink,
      marginBottom: 8,
      fontFamily: fonts.display,
    },
    body: { fontSize: 15, color: c.inkSoft, marginBottom: 28, lineHeight: 22 },
    bold: { fontWeight: '600', color: c.ink },
    input: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      marginBottom: 16,
      backgroundColor: c.surface,
    },
    btn: {
      backgroundColor: c.terracotta,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: c.surface, fontSize: 16, fontWeight: '700' },
    link: { marginTop: 20, alignItems: 'center' },
    linkText: { color: c.terracotta, fontSize: 14, fontWeight: '500' },
  })
