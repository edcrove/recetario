import { useState } from 'react'
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import { useAuth } from '../../src/providers/AuthProvider'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

export default function RegisterScreen() {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const router = useRouter()
  const { signIn } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    if (!email.trim() || !password) {
      setError('El email y la contraseña son obligatorios.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { token } = await api.auth.register({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      })
      await signIn(token)
      router.replace('/')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('409') || msg.includes('already')) {
        setError('Este email ya está registrado.')
      } else {
        setError('Error al registrarse. Intentá de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Crear cuenta</Text>
        <Text style={s.subtitle}>Unite a Recetario y empezá a cocinar</Text>

        <Text style={s.label}>Nombre (opcional)</Text>
        <TextInput
          style={s.input}
          placeholder="Tu nombre"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
        />

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          placeholder="vos@ejemplo.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Text style={s.label}>Contraseña</Text>
        <TextInput
          style={s.input}
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <Text style={s.label}>Confirmá la contraseña</Text>
        <TextInput
          style={s.input}
          placeholder="Repetí la contraseña"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
          autoComplete="new-password"
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity
          testID="auth-register-submit"
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>Crear cuenta</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => router.push('/auth/login')}>
          <Text style={s.linkText}>
            ¿Ya tenés cuenta? <Text style={s.linkBold}>Ingresá</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.ink,
      marginBottom: 4,
      fontFamily: fonts.display,
    },
    subtitle: { fontSize: 15, color: c.inkSoft, marginBottom: 28 },
    label: { fontSize: 13, fontWeight: '600', color: c.ink, marginBottom: 4, marginTop: 8 },
    input: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      marginBottom: 4,
      backgroundColor: c.surface,
    },
    error: { color: c.danger, fontSize: 14, marginVertical: 8 },
    btn: {
      backgroundColor: c.terracotta,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 16,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: c.surface, fontSize: 16, fontWeight: '700' },
    link: { marginTop: 20, alignItems: 'center' },
    linkText: { color: c.inkSoft, fontSize: 14 },
    linkBold: { color: c.terracotta, fontWeight: '600' },
  })
