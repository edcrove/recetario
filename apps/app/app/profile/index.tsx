import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../src/api/client'
import { useAuth } from '../../src/providers/AuthProvider'

export default function ProfileScreen() {
  const router = useRouter()
  const { signOut } = useAuth()

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
  })

  async function handleSignOut() {
    await signOut()
    router.replace('/auth/login')
  }

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>
          {user?.displayName?.[0]?.toUpperCase() ?? user?.email[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <Text style={s.name}>{user?.displayName ?? 'No name set'}</Text>
      <Text style={s.email}>{user?.email}</Text>

      <View style={s.section}>
        <TouchableOpacity style={s.row} onPress={() => router.push('/auth/forgot')}>
          <Text style={s.rowText}>Change password</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  email: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 4, marginBottom: 32 },
  section: {
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  rowText: { fontSize: 16, color: '#111827' },
  chevron: { fontSize: 20, color: '#9ca3af' },
  signOutBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
})
