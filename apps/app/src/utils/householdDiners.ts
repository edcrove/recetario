import { normalizeAllergens, toAllergenKey, type HouseholdDiner } from '@recetario/shared'

interface HouseholdLike {
  members?: { userId: string; acceptedAt?: string | null }[]
  diners?: HouseholdDiner[]
}

interface RestrictionsLike {
  allergens?: string[]
  dietaryRestrictions?: string[]
}

/**
 * The diners of every household the user has joined (a pending invite shares
 * nothing, the same rule as the API).
 */
export function joinedDiners(
  households: HouseholdLike[] | undefined,
  userId: string | null,
): HouseholdDiner[] {
  if (!households || !userId) return []
  return households
    .filter((h) => h.members?.some((m) => m.userId === userId && !!m.acceptedAt))
    .flatMap((h) => h.diners ?? [])
}

/**
 * The user's own restrictions plus every diner's: the warnings are about
 * everyone who eats at the table, not only the person looking.
 */
export function withDiners<P extends RestrictionsLike>(profile: P, diners: HouseholdDiner[]): P {
  if (diners.length === 0) return profile
  return {
    ...profile,
    allergens: normalizeAllergens([
      ...(profile.allergens ?? []),
      ...diners.flatMap((d) => d.allergens),
    ]),
    dietaryRestrictions: [
      ...new Set([
        ...(profile.dietaryRestrictions ?? []),
        ...diners.flatMap((d) => d.dietaryRestrictions),
      ]),
    ],
  }
}

/**
 * Who a matched allergen or diet is for, to show next to it: "vos" for the
 * user's own, then each diner's name. Empty when nobody is named (legacy text).
 */
export function whoFor(
  restriction: string,
  profile: RestrictionsLike,
  diners: HouseholdDiner[],
): string[] {
  const key = toAllergenKey(restriction) ?? restriction
  const has = (list: string[] | undefined) =>
    (list ?? []).some((r) => (toAllergenKey(r) ?? r) === key)
  const names = diners
    .filter((d) => has(d.allergens) || has(d.dietaryRestrictions))
    .map((d) => d.name)
  return has(profile.allergens) || has(profile.dietaryRestrictions) ? ['vos', ...names] : names
}
