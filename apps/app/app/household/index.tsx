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
import { refreshAfter } from '../../src/utils/menuCache'
import { ErrorState } from '../../src/components/ErrorState'
import { HouseholdDiners } from '../../src/components/HouseholdDiners'
import { useAuth } from '../../src/providers/AuthProvider'
import { confirmAsync, notify } from '../../src/utils/platformAlert'
import {
  canChangeRole,
  canLeaveHousehold,
  inviteErrorMessage,
  memberLabel,
  pendingInvitations,
} from '../../src/utils/roles'
import { useThemeColors, fonts, type ThemeColors } from '../../src/theme/tokens'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  admin: 'Admin',
  member: 'Miembro',
  viewer: 'Espectador',
}

/** Role badge backgrounds from the palette (text uses terracottaInk/ink). */
function roleColor(role: string, c: ThemeColors): string {
  if (role === 'owner') return c.terracotta
  if (role === 'admin') return c.sage
  return c.inkSoft
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
  // `${householdId}:${userId}` of the member whose role picker is open
  const [roleEditFor, setRoleEditFor] = useState<string | null>(null)

  const {
    data: households = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
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
      role: 'admin' | 'member' | 'viewer'
    }) => api.households.invite(householdId, email, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['households'] })
      setInviteEmail('')
      setInvitingFor(null)
    },
    onError: (err) => notify('No se pudo invitar', inviteErrorMessage(err)),
  })

  // Joining, leaving or a member's change alters what every shared screen shows
  const refreshShared = () => void refreshAfter(queryClient, 'household')
  const acceptInvite = useMutation({
    mutationFn: (householdId: string) => api.households.accept(householdId),
    onSuccess: refreshShared,
    onError: () => notify('Error', 'No se pudo aceptar la invitación. Probá de nuevo.'),
  })
  const declineInvite = useMutation({
    mutationFn: (householdId: string) => api.households.decline(householdId),
    onSuccess: refreshShared,
    onError: () => notify('Error', 'No se pudo rechazar la invitación. Probá de nuevo.'),
  })

  const removeMember = useMutation({
    mutationFn: ({ householdId, userId }: { householdId: string; userId: string }) =>
      api.households.removeMember(householdId, userId),
    // Their recipes, dishes and pantry items leave every shared screen
    onSuccess: refreshShared,
    onError: () => notify('Error', 'No se pudo quitar al miembro. Probá de nuevo.'),
  })

  const changeRole = useMutation({
    mutationFn: ({
      householdId,
      userId,
      role,
    }: {
      householdId: string
      userId: string
      role: 'admin' | 'member' | 'viewer'
    }) => api.households.changeRole(householdId, userId, role),
    onSuccess: () => {
      // A viewer change alters what that person may edit on every shared screen
      refreshShared()
      setRoleEditFor(null)
    },
    onError: () => notify('Error', 'No se pudo cambiar el rol. Probá de nuevo.'),
  })

  const leaveHousehold = useMutation({
    mutationFn: (householdId: string) => api.households.leave(householdId),
    onSuccess: refreshShared,
    onError: () => notify('Error', 'No se pudo abandonar el hogar. Probá de nuevo.'),
  })

  const pending = pendingInvitations(households, userId)
  const joined = households.filter((h) => !pending.includes(h))

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  // Not "no household yet": that would offer to create a second one
  if (error)
    return <ErrorState message="No se pudo cargar tu hogar." onRetry={() => void refetch()} />

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Invitations waiting for me */}
      {pending.map((hh) => {
        const me = hh.members?.find((m) => m.userId === userId)
        const owner = hh.members?.find((m) => m.role === 'owner')
        return (
          <View key={hh.id} testID={`household-invitation-${hh.id}`} style={s.inviteCard}>
            <Text style={s.householdName}>✉️ Te invitaron a {hh.name}</Text>
            <Text style={s.emptyBody}>
              {owner ? `${memberLabel(owner)} te invitó` : 'Te invitaron'} como{' '}
              {(ROLE_LABELS[me?.role ?? ''] ?? me?.role ?? '').toLowerCase()}. Al aceptar, van a
              compartir recetas, el menú semanal y la lista de compras.
            </Text>
            <View style={s.inviteActions}>
              <TouchableOpacity
                testID={`household-accept-${hh.id}`}
                style={[s.btn, s.btnSm]}
                disabled={acceptInvite.isPending}
                onPress={() => acceptInvite.mutate(hh.id)}
              >
                <Text style={s.btnText}>Aceptar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`household-decline-${hh.id}`}
                disabled={declineInvite.isPending}
                onPress={async () => {
                  const confirmed = await confirmAsync(
                    'Rechazar invitación',
                    `¿Rechazar la invitación a ${hh.name}?`,
                  )
                  if (confirmed) declineInvite.mutate(hh.id)
                }}
              >
                <Text style={s.cancelText}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      })}

      {/* Create household */}
      {joined.length === 0 && (
        <View style={s.emptyCard}>
          <Text style={s.emptyTitle}>Creá tu hogar</Text>
          <Text style={s.emptyBody}>
            Un hogar te permite compartir recetas y planes de comida con tu familia o compañeros de
            casa.
          </Text>
          <TextInput
            placeholderTextColor={colors.inkSoft}
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
      {joined.map((hh) => {
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
                  <View style={[s.roleBadge, { backgroundColor: roleColor(m.role, colors) }]}>
                    <Text style={s.roleBadgeText}>{ROLE_LABELS[m.role] ?? m.role}</Text>
                  </View>
                  <Text style={s.memberUserId} numberOfLines={1}>
                    {memberLabel(m)}
                  </Text>
                  {!m.acceptedAt && <Text style={s.pending}>Pendiente</Text>}
                </View>
                {canChangeRole(myRole, m) && (
                  <TouchableOpacity
                    testID={`household-change-role-${m.userId}`}
                    role="button"
                    aria-label={`Cambiar el rol de ${memberLabel(m)}`}
                    style={s.roleEditBtn}
                    onPress={() =>
                      setRoleEditFor((cur) =>
                        cur === `${hh.id}:${m.userId}` ? null : `${hh.id}:${m.userId}`,
                      )
                    }
                  >
                    <Text style={s.roleEditText}>Rol</Text>
                  </TouchableOpacity>
                )}
                {m.role !== 'owner' && canManageMembers && (
                  <TouchableOpacity
                    testID={`household-remove-member-${m.userId}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar a ${memberLabel(m)}`}
                    onPress={async () => {
                      const confirmed = await confirmAsync(
                        'Quitar miembro',
                        `¿Quitar a ${memberLabel(m)} de ${hh.name}?`,
                      )
                      if (confirmed) removeMember.mutate({ householdId: hh.id, userId: m.userId })
                    }}
                  >
                    <Text style={s.removeText}>✕</Text>
                  </TouchableOpacity>
                )}
                {roleEditFor === `${hh.id}:${m.userId}` && (
                  <View style={s.rolePicker} testID={`household-role-picker-${m.userId}`}>
                    {(['admin', 'member', 'viewer'] as const).map((r) => {
                      const current = m.role === r
                      return (
                        <TouchableOpacity
                          key={r}
                          testID={`household-role-option-${m.userId}-${r}`}
                          aria-selected={current}
                          style={[s.roleChip, current && s.roleChipActive]}
                          disabled={current || changeRole.isPending}
                          onPress={() =>
                            changeRole.mutate({ householdId: hh.id, userId: m.userId, role: r })
                          }
                        >
                          <Text style={[s.roleChipText, current && s.roleChipTextActive]}>
                            {ROLE_LABELS[r]}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </View>
            ))}

            <HouseholdDiners
              householdId={hh.id}
              diners={hh.diners ?? []}
              canEdit={!!myRole && myRole !== 'viewer'}
            />

            {/* Invite */}
            {canManageMembers &&
              (invitingFor === hh.id ? (
                <View style={s.inviteBox}>
                  <Text style={s.inviteLabel}>Email a invitar</Text>
                  <Text style={s.hint}>
                    La persona tiene que tener una cuenta en Recetario. Va a ver la invitación en Mi
                    hogar.
                  </Text>
                  <TextInput
                    placeholderTextColor={colors.inkSoft}
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

            {canLeaveHousehold(hh.members?.find((m) => m.userId === userId)) && (
              <TouchableOpacity
                testID={`household-leave-${hh.id}`}
                accessibilityRole="button"
                style={s.leaveBtn}
                disabled={leaveHousehold.isPending}
                onPress={async () => {
                  const confirmed = await confirmAsync(
                    'Abandonar hogar',
                    `¿Abandonar ${hh.name}? Vas a dejar de ver sus recetas, el menú semanal y la lista de compras.`,
                  )
                  if (confirmed) leaveHousehold.mutate(hh.id)
                }}
              >
                <Text style={s.leaveText}>Abandonar hogar</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      })}

      {/* Add another household */}
      {joined.length > 0 && (
        <View style={s.addCard}>
          <TextInput
            placeholderTextColor={colors.inkSoft}
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
    center: { flex: 1, backgroundColor: c.paper, justifyContent: 'center', alignItems: 'center' },
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
    inviteCard: {
      backgroundColor: c.terracottaSoft,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    addCard: { backgroundColor: c.surface, borderRadius: 12, padding: 16 },
    roleEditBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: c.sand,
      marginRight: 8,
    },
    roleEditText: { fontSize: 13, fontWeight: '600', color: c.ink },
    leaveBtn: { marginTop: 16, alignSelf: 'flex-start', paddingVertical: 6 },
    leaveText: { fontSize: 14, fontWeight: '600', color: c.danger },
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
      flexWrap: 'wrap',
      paddingVertical: 6,
    },
    rolePicker: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 8 },
    memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    roleBadgeText: { color: c.surface, fontSize: 11, fontWeight: '700' },
    memberUserId: { fontSize: 14, color: c.ink, flex: 1 },
    pending: { fontSize: 11, color: c.warning, fontWeight: '600' },
    removeText: { color: c.danger, fontSize: 16, paddingHorizontal: 8 },
    inviteBox: { marginTop: 12, borderTopWidth: 1, borderColor: c.line, paddingTop: 12 },
    hint: { fontSize: 12, color: c.inkSoft, marginBottom: 8, lineHeight: 17 },
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
      color: c.ink,
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
