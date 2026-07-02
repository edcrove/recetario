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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../src/api/client'
import { useAuth } from '../../src/providers/AuthProvider'
import { confirmAsync, notify } from '../../src/utils/platformAlert'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  admin: 'Admin',
  member: 'Miembro',
  viewer: 'Espectador',
}

const ROLE_COLORS: Record<string, string> = {
  owner: '#7c3aed',
  admin: '#2563eb',
  member: '#16a34a',
  viewer: '#6b7280',
}

export default function HouseholdScreen() {
  const queryClient = useQueryClient()
  const { token } = useAuth()
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [invitingFor, setInvitingFor] = useState<string | null>(null)

  const { data: households = [], isLoading } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.households.mine(),
    enabled: !!token,
  })

  const createHousehold = useMutation({
    mutationFn: (name: string) => api.households.create(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['households'] })
      setNewHouseholdName('')
    },
  })

  const inviteMember = useMutation({
    mutationFn: ({
      householdId,
      userId,
      role,
    }: {
      householdId: string
      userId: string
      role: string
    }) => api.households.invite(householdId, userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['households'] })
      setInviteUserId('')
      setInvitingFor(null)
    },
    onError: () => notify('Error', 'No se pudo invitar al usuario. Verificá el ID.'),
  })

  const removeMember = useMutation({
    mutationFn: ({ householdId, userId }: { householdId: string; userId: string }) =>
      api.households.removeMember(householdId, userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['households'] }),
  })

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Create household */}
      {households.length === 0 && (
        <View style={s.emptyCard}>
          <Text style={s.emptyTitle}>Creá tu hogar</Text>
          <Text style={s.emptyBody}>
            Un hogar te permite compartir recetas y planes de comida con tu familia o compañeros de
            casa.
          </Text>
          <TextInput
            style={s.input}
            placeholder="ej. Familia García"
            value={newHouseholdName}
            onChangeText={setNewHouseholdName}
          />
          <TouchableOpacity
            style={[s.btn, !newHouseholdName.trim() && s.btnDisabled]}
            disabled={!newHouseholdName.trim() || createHousehold.isPending}
            onPress={() => createHousehold.mutate(newHouseholdName.trim())}
          >
            <Text style={s.btnText}>Crear hogar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Households list */}
      {households.map((hh) => (
        <View key={hh.id} style={s.card}>
          <Text style={s.householdName}>🏠 {hh.name}</Text>

          {/* Members */}
          <Text style={s.sectionLabel}>Miembros</Text>
          {(hh.members ?? []).map((m) => (
            <View key={m.userId} style={s.memberRow}>
              <View style={s.memberInfo}>
                <View style={[s.roleBadge, { backgroundColor: ROLE_COLORS[m.role] ?? '#6b7280' }]}>
                  <Text style={s.roleBadgeText}>{ROLE_LABELS[m.role] ?? m.role}</Text>
                </View>
                <Text style={s.memberUserId} numberOfLines={1}>
                  {m.userId.slice(0, 8)}…
                </Text>
                {!m.acceptedAt && <Text style={s.pending}>Pendiente</Text>}
              </View>
              {m.role !== 'owner' && hh.ownerId === hh.ownerId && (
                <TouchableOpacity
                  onPress={async () => {
                    const confirmed = await confirmAsync(
                      'Quitar miembro',
                      '¿Quitar a este miembro del hogar?',
                    )
                    if (confirmed) removeMember.mutate({ householdId: hh.id, userId: m.userId })
                  }}
                >
                  <Text style={s.removeText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Invite */}
          {invitingFor === hh.id ? (
            <View style={s.inviteBox}>
              <Text style={s.inviteLabel}>ID de usuario a invitar</Text>
              <TextInput
                style={s.input}
                placeholder="Pegá el UUID del usuario"
                value={inviteUserId}
                onChangeText={setInviteUserId}
                autoCapitalize="none"
              />
              <View style={s.roleRow}>
                {(['admin', 'member', 'viewer'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[s.roleChip, inviteRole === r && s.roleChipActive]}
                    onPress={() => setInviteRole(r)}
                  >
                    <Text style={[s.roleChipText, inviteRole === r && s.roleChipTextActive]}>
                      {ROLE_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.inviteActions}>
                <TouchableOpacity
                  style={[s.btn, s.btnSm, !inviteUserId.trim() && s.btnDisabled]}
                  disabled={!inviteUserId.trim() || inviteMember.isPending}
                  onPress={() =>
                    inviteMember.mutate({
                      householdId: hh.id,
                      userId: inviteUserId.trim(),
                      role: inviteRole,
                    })
                  }
                >
                  <Text style={s.btnText}>Enviar invitación</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setInvitingFor(null)}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.inviteBtn} onPress={() => setInvitingFor(hh.id)}>
              <Text style={s.inviteBtnText}>+ Invitar miembro</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Add another household */}
      {households.length > 0 && (
        <View style={s.addCard}>
          <TextInput
            style={s.input}
            placeholder="Nombre del nuevo hogar…"
            value={newHouseholdName}
            onChangeText={setNewHouseholdName}
          />
          <TouchableOpacity
            style={[s.btn, !newHouseholdName.trim() && s.btnDisabled]}
            disabled={!newHouseholdName.trim() || createHousehold.isPending}
            onPress={() => createHousehold.mutate(newHouseholdName.trim())}
          >
            <Text style={s.btnText}>Crear otro hogar</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 20, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptyBody: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16 },
  card: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 16 },
  addCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16 },
  householdName: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  memberUserId: { fontSize: 13, color: '#6b7280', flex: 1 },
  pending: { fontSize: 11, color: '#f59e0b', fontWeight: '600' },
  removeText: { color: '#ef4444', fontSize: 16, paddingHorizontal: 8 },
  inviteBox: { marginTop: 12, borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 12 },
  inviteLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  roleChipActive: { backgroundColor: '#2563eb' },
  roleChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  roleChipTextActive: { color: '#fff', fontWeight: '600' },
  inviteActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteBtn: { marginTop: 12, paddingVertical: 8, alignItems: 'center' },
  inviteBtnText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  btn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnSm: { flex: 1 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelText: { color: '#6b7280', fontSize: 14 },
})
