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

export default function ForgotPasswordScreen() {
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
          <Text style={s.title}>Check your email</Text>
          <Text style={s.body}>
            If <Text style={s.bold}>{email}</Text> is registered, you'll receive a password reset
            link shortly.
          </Text>
          <TouchableOpacity style={s.btn} onPress={() => router.push('/auth/login')}>
            <Text style={s.btnText}>Back to Sign In</Text>
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
        <Text style={s.title}>Reset password</Text>
        <Text style={s.body}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <TextInput
          style={s.input}
          placeholder="you@example.com"
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
          <Text style={s.btnText}>Send reset link</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => router.back()}>
          <Text style={s.linkText}>← Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  icon: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 8 },
  body: { fontSize: 15, color: '#6b7280', marginBottom: 28, lineHeight: 22 },
  bold: { fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '500' },
})
