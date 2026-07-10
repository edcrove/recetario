interface HouseholdLike {
  members?: { userId: string; role: string }[]
}

/**
 * True when the user holds the 'viewer' role in ANY of their households.
 * Mirrors the API's write-blocking rule (see api/db/household-visibility.ts):
 * a viewer's menu entries would surface in the shared week view, so the UI
 * hides every menu-mutation affordance for them.
 */
export function isViewerInAnyHousehold(
  households: HouseholdLike[] | undefined,
  userId: string | null,
): boolean {
  if (!households || !userId) return false
  return households.some((h) => h.members?.some((m) => m.userId === userId && m.role === 'viewer'))
}

/** True when the recipe belongs to someone else (a housemate's shared recipe). */
export function isForeignRecipe(ownerId: string | undefined, userId: string | null): boolean {
  return ownerId !== undefined && userId !== null && ownerId !== userId
}
