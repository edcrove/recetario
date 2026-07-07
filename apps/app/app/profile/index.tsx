import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../src/api/client'
import { useAuth } from '../../src/providers/AuthProvider'
import { confirmAsync } from '../../src/utils/platformAlert'

const DIETARY_OPTIONS = [
  'vegano',
  'vegetariano',
  'sin-gluten',
  'sin-lactosa',
  'keto',
  'paleo',
] as const

type DietaryOption = (typeof DIETARY_OPTIONS)[number]

export default function ProfileScreen() {
  const router = useRouter()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
  })

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.auth.getProfile(),
  })

  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState('')

  const updateMe = useMutation({
    mutationFn: (data: { displayName: string }) => api.auth.updateMe(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      setEditingName(false)
    },
  })

  const updateProfile = useMutation({
    mutationFn: api.auth.updateProfile,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })

  function toggleDiet(option: DietaryOption) {
    const current = (profile?.dietaryRestrictions ?? []) as DietaryOption[]
    const next = current.includes(option)
      ? current.filter((d) => d !== option)
      : [...current, option]
    updateProfile.mutate({ dietaryRestrictions: next })
  }

  function updateServings(delta: number) {
    const current = profile?.preferredServings ?? 2
    const next = Math.max(1, Math.min(20, current + delta))
    updateProfile.mutate({ preferredServings: next })
  }

  function updateTarget(
    field: 'daily_calories' | 'daily_protein_g' | 'daily_carbs_g' | 'daily_fat_g',
    delta: number,
  ) {
    const t = (profile?.nutritionTargets as Record<string, number> | null) ?? {
      daily_calories: 2000,
      daily_protein_g: 50,
      daily_carbs_g: 250,
      daily_fat_g: 70,
    }
    const current = t[field] ?? 0
    const next = Math.max(0, current + delta)
    updateProfile.mutate({
      nutritionTargets: {
        daily_calories: t['daily_calories'] ?? 2000,
        daily_protein_g: t['daily_protein_g'] ?? 50,
        daily_carbs_g: t['daily_carbs_g'] ?? 250,
        daily_fat_g: t['daily_fat_g'] ?? 70,
        [field]: next,
      },
    } as never)
  }

  async function handleSignOut() {
    await signOut()
    router.replace('/auth/login')
  }

  if (userLoading || profileLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  const dietary = (profile?.dietaryRestrictions ?? []) as DietaryOption[]
  const servings = profile?.preferredServings ?? 2

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Avatar */}
      <View style={s.avatar}>
        <Text style={s.avatarText}>
          {user?.displayName?.[0]?.toUpperCase() ?? user?.email[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>

      {/* Name */}
      {editingName ? (
        <View style={s.nameRow}>
          <TextInput
            style={s.nameInput}
            value={displayName}
            onChangeText={setDisplayName}
            autoFocus
            onSubmitEditing={() => updateMe.mutate({ displayName })}
          />
          <TouchableOpacity onPress={() => updateMe.mutate({ displayName })}>
            <Text style={s.saveText}>Guardar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditingName(false)}>
            <Text style={s.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => {
            setDisplayName(user?.displayName ?? '')
            setEditingName(true)
          }}
        >
          <Text style={s.name}>{user?.displayName ?? 'Agregá tu nombre'}</Text>
          <Text style={s.editHint}>tocá para editar</Text>
        </TouchableOpacity>
      )}
      <Text style={s.email}>{user?.email}</Text>

      {/* Preferred servings */}
      <Text style={s.sectionTitle}>Porciones por defecto</Text>
      <View style={s.servingsRow}>
        <TouchableOpacity style={s.servingsBtn} onPress={() => updateServings(-1)}>
          <Text style={s.servingsBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.servingsValue}>{servings}</Text>
        <TouchableOpacity style={s.servingsBtn} onPress={() => updateServings(1)}>
          <Text style={s.servingsBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Dietary restrictions */}
      <Text style={s.sectionTitle}>Preferencias dietéticas</Text>
      <View style={s.chips}>
        {DIETARY_OPTIONS.map((opt) => {
          const active = dietary.includes(opt)
          return (
            <TouchableOpacity
              key={opt}
              style={[s.chip, active && s.chipActive]}
              onPress={() => toggleDiet(opt)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Configurator */}
      <TouchableOpacity style={s.row} onPress={() => router.push('/config')}>
        <Text style={s.rowText}>⚙️ Configuración de taxonomía</Text>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>

      {/* Stats */}
      <TouchableOpacity style={s.row} onPress={() => router.push('/stats')}>
        <Text style={s.rowText}>📊 Estadísticas</Text>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>

      {/* Nutrition targets */}
      <Text style={s.sectionTitle}>Objetivos nutricionales diarios</Text>
      {(
        [
          { field: 'daily_calories' as const, label: 'Calorías', unit: 'kcal', step: 100 },
          { field: 'daily_protein_g' as const, label: 'Proteína', unit: 'g', step: 5 },
          { field: 'daily_carbs_g' as const, label: 'Carbohidratos', unit: 'g', step: 10 },
          { field: 'daily_fat_g' as const, label: 'Grasa', unit: 'g', step: 5 },
        ] as const
      ).map(({ field, label, unit, step }) => {
        const t = profile?.nutritionTargets as Record<string, number> | null
        const val = t?.[field] ?? 0
        return (
          <View key={field} style={s.targetRow}>
            <Text style={s.targetLabel}>{label}</Text>
            <TouchableOpacity style={s.servingsBtn} onPress={() => updateTarget(field, -step)}>
              <Text style={s.servingsBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.targetValue}>
              {val}
              <Text style={s.targetUnit}> {unit}</Text>
            </Text>
            <TouchableOpacity style={s.servingsBtn} onPress={() => updateTarget(field, step)}>
              <Text style={s.servingsBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )
      })}

      {/* Household */}
      <TouchableOpacity style={s.row} onPress={() => router.push('/household')}>
        <Text style={s.rowText}>🏠 Mi hogar</Text>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>

      {/* Sign out */}
      <TouchableOpacity
        testID="profile-signout"
        style={s.signOutBtn}
        onPress={async () => {
          const confirmed = await confirmAsync('Cerrar sesión', '¿Estás seguro?')
          if (confirmed) await handleSignOut()
        }}
      >
        <Text style={s.signOutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
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
    marginBottom: 8,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  nameInput: {
    borderBottomWidth: 1,
    borderColor: '#2563eb',
    fontSize: 20,
    fontWeight: '600',
    padding: 4,
    minWidth: 120,
    textAlign: 'center',
  },
  saveText: { color: '#2563eb', fontWeight: '600' },
  cancelText: { color: '#9ca3af' },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  editHint: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginBottom: 2 },
  email: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 20,
  },
  servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  servingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingsBtnText: { fontSize: 20, color: '#374151' },
  targetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  targetLabel: { flex: 1, fontSize: 14, color: '#374151' },
  targetValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    minWidth: 60,
    textAlign: 'center',
  },
  targetUnit: { fontSize: 12, fontWeight: '400', color: '#9ca3af' },
  servingsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    minWidth: 32,
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { color: '#2563eb', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
    marginTop: 24,
  },
  rowText: { fontSize: 16, color: '#111827' },
  chevron: { fontSize: 20, color: '#9ca3af' },
  signOutBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  signOutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
})
