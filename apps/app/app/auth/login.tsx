import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { api } from '../../src/api/client'
import { useAuth } from '../../src/providers/AuthProvider'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

export default function LoginScreen() {
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const router = useRouter()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('El email y la contraseña son obligatorios.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { token } = await api.auth.login({ email: email.trim(), password })
      await signIn(token)
      router.replace('/')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('401') || msg.includes('Invalid') || msg.includes('incorrect')) {
        setError('Email o contraseña incorrectos.')
      } else {
        setError(`Error al conectar con el servidor. (${msg})`)
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
      <View style={s.inner}>
        <Text style={s.title}>Recetario</Text>
        <Text style={s.subtitle}>Ingresá a tu cuenta</Text>

        <TextInput
          placeholderTextColor={colors.inkSoft}
          style={s.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextInput
          placeholderTextColor={colors.inkSoft}
          style={s.input}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity
          testID="auth-login-submit"
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Ingresar</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => router.push('/auth/forgot')}>
          <Text style={s.linkText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => router.push('/auth/register')}>
          <Text style={s.linkText}>
            ¿No tenés cuenta? <Text style={s.linkBold}>Registrate</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: c.terracotta,
      textAlign: 'center',
      marginBottom: 4,
      fontFamily: fonts.display,
    },
    subtitle: { fontSize: 16, color: c.inkSoft, textAlign: 'center', marginBottom: 32 },
    input: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      marginBottom: 12,
      backgroundColor: c.surface,
      color: c.ink,
    },
    error: { color: c.danger, fontSize: 14, marginBottom: 8 },
    btn: {
      backgroundColor: c.terracotta,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: c.surface, fontSize: 16, fontWeight: '700' },
    link: { marginTop: 16, alignItems: 'center' },
    linkText: { color: c.inkSoft, fontSize: 14 },
    linkBold: { color: c.terracotta, fontWeight: '600' },
  })
