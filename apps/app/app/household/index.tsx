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
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

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
  const colors = useThemeColors()
  const s = makeStyles(colors)
  const queryClient = useQueryClient()
  const { token, userId } = useAuth()
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
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
      email,
      role,
    }: {
      householdId: string
      email: string
      role: string
    }) => api.households.invite(householdId, email, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['households'] })
      setInviteEmail('')
      setInvitingFor(null)
    },
    onError: () => notify('Error', 'No se encontró ningún usuario con ese email.'),
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
            testID="household-create-name-input"
            style={s.input}
            placeholder="ej. Familia García"
            value={newHouseholdName}
            onChangeText={setNewHouseholdName}
          />
          <TouchableOpacity
            testID="household-create-submit"
            style={[s.btn, !newHouseholdName.trim() && s.btnDisabled]}
            disabled={!newHouseholdName.trim() || createHousehold.isPending}
            onPress={() => createHousehold.mutate(newHouseholdName.trim())}
          >
            <Text style={s.btnText}>Crear hogar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Households list */}
      {households.map((hh) => {
        const myRole = hh.members?.find((m) => m.userId === userId)?.role
        const canManageMembers = myRole === 'owner' || myRole === 'admin'
        return (
          <View key={hh.id} style={s.card}>
            <Text style={s.householdName}>🏠 {hh.name}</Text>

            {/* Members */}
            <Text style={s.sectionLabel}>Miembros</Text>
            {(hh.members ?? []).map((m) => (
              <View key={m.userId} style={s.memberRow}>
                <View style={s.memberInfo}>
                  <View
                    style={[s.roleBadge, { backgroundColor: ROLE_COLORS[m.role] ?? '#6b7280' }]}
                  >
                    <Text style={s.roleBadgeText}>{ROLE_LABELS[m.role] ?? m.role}</Text>
                  </View>
                  <Text style={s.memberUserId} numberOfLines={1}>
                    {m.userId.slice(0, 8)}…
                  </Text>
                  {!m.acceptedAt && <Text style={s.pending}>Pendiente</Text>}
                </View>
                {m.role !== 'owner' && canManageMembers && (
                  <TouchableOpacity
                    testID={`household-remove-member-${m.userId}`}
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
            {canManageMembers &&
              (invitingFor === hh.id ? (
                <View style={s.inviteBox}>
                  <Text style={s.inviteLabel}>Email a invitar</Text>
                  <TextInput
                    testID="household-invite-email-input"
                    style={s.input}
                    placeholder="familiar@ejemplo.com"
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <View style={s.roleRow}>
                    {(['admin', 'member', 'viewer'] as const).map((r) => (
                      <TouchableOpacity
                        key={r}
                        testID={`household-invite-role-${r}`}
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
                      testID="household-invite-submit"
                      style={[s.btn, s.btnSm, !inviteEmail.trim() && s.btnDisabled]}
                      disabled={!inviteEmail.trim() || inviteMember.isPending}
                      onPress={() =>
                        inviteMember.mutate({
                          householdId: hh.id,
                          email: inviteEmail.trim(),
                          role: inviteRole,
                        })
                      }
                    >
                      <Text style={s.btnText}>Enviar invitación</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="household-invite-cancel"
                      onPress={() => setInvitingFor(null)}
                    >
                      <Text style={s.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  testID="household-invite-open"
                  style={s.inviteBtn}
                  onPress={() => setInvitingFor(hh.id)}
                >
                  <Text style={s.inviteBtnText}>+ Invitar miembro</Text>
                </TouchableOpacity>
              ))}
          </View>
        )
      })}

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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    content: { padding: 20, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyCard: { backgroundColor: c.surface, borderRadius: 12, padding: 20, marginBottom: 16 },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.ink,
      marginBottom: 6,
      fontFamily: fonts.display,
    },
    emptyBody: { fontSize: 14, color: c.inkSoft, lineHeight: 20, marginBottom: 16 },
    card: { backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 16 },
    addCard: { backgroundColor: c.surface, borderRadius: 12, padding: 16 },
    householdName: { fontSize: 18, fontWeight: '700', color: c.ink, marginBottom: 12 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.inkSoft,
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
    roleBadgeText: { color: c.surface, fontSize: 11, fontWeight: '700' },
    memberUserId: { fontSize: 13, color: c.inkSoft, flex: 1 },
    pending: { fontSize: 11, color: '#f59e0b', fontWeight: '600' },
    removeText: { color: c.danger, fontSize: 16, paddingHorizontal: 8 },
    inviteBox: { marginTop: 12, borderTopWidth: 1, borderColor: c.line, paddingTop: 12 },
    inviteLabel: { fontSize: 13, fontWeight: '600', color: c.ink, marginBottom: 6 },
    roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    roleChip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 16,
      backgroundColor: c.line,
    },
    roleChipActive: { backgroundColor: c.terracotta },
    roleChipText: { fontSize: 13, color: c.ink, fontWeight: '500' },
    roleChipTextActive: { color: c.surface, fontWeight: '600' },
    inviteActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    inviteBtn: { marginTop: 12, paddingVertical: 8, alignItems: 'center' },
    inviteBtnText: { color: c.terracotta, fontWeight: '600', fontSize: 14 },
    input: {
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      backgroundColor: c.surface,
      marginBottom: 8,
    },
    btn: {
      backgroundColor: c.terracotta,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    btnSm: { flex: 1 },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: c.surface, fontWeight: '600', fontSize: 15 },
    cancelText: { color: c.inkSoft, fontSize: 14 },
  })
