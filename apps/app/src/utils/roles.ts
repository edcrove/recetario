interface MemberLike {
  userId: string
  role: string
  acceptedAt?: string | null
  displayName?: string | null
  email?: string
}

interface HouseholdLike {
  id?: string
  name?: string
  members?: MemberLike[]
}

/**
 * True when the user holds the 'viewer' role in ANY of their households.
 * Mirrors the API's write-blocking rule (see api/db/household-visibility.ts):
 * viewers are read-only on the shared menu, shopping list and pantry, so the
 * UI hides those mutation affordances for them (see useIsViewer).
 */
export function isViewerInAnyHousehold(
  households: HouseholdLike[] | undefined,
  userId: string | null,
): boolean {
  if (!households || !userId) return false
  // A pending invite grants nothing and restricts nothing (same rule as the API)
  return households.some((h) =>
    h.members?.some((m) => m.userId === userId && m.role === 'viewer' && !!m.acceptedAt),
  )
}

/** How to name a member on screen: display name, else email, else a short id. */
export function memberLabel(m: MemberLike): string {
  return m.displayName?.trim() || m.email || `${m.userId.slice(0, 8)}…`
}

/** Households where the user has been invited but hasn't accepted yet. */
export function pendingInvitations<H extends HouseholdLike>(
  households: H[] | undefined,
  userId: string | null,
): H[] {
  if (!households || !userId) return []
  return households.filter((h) => h.members?.some((m) => m.userId === userId && !m.acceptedAt))
}

/** Spanish message for a failed invite, from the API error text ("API 404: …"). */
export function inviteErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : ''
  if (msg.includes('404'))
    return 'No hay ninguna cuenta con ese email. Pedile que se registre primero.'
  if (msg.includes('409'))
    return 'Esa persona ya está en el hogar o tiene una invitación pendiente.'
  if (msg.includes('403')) return 'Solo el dueño o un admin pueden invitar.'
  return 'No se pudo enviar la invitación. Probá de nuevo.'
}

/** True when the recipe belongs to someone else (a housemate's shared recipe). */
export function isForeignRecipe(ownerId: string | undefined, userId: string | null): boolean {
  return ownerId !== undefined && userId !== null && ownerId !== userId
}
