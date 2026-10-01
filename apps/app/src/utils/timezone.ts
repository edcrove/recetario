/** The device's IANA time zone ("America/Montevideo"); Intl ships in every supported runtime. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * The time zone to store on the profile, or null to leave it alone. Only the
 * untouched default (null/UTC) is replaced, so a zone someone set on purpose
 * is never overwritten by whichever device they open the app on.
 */
export function timezoneToSync(
  stored: string | null | undefined,
  device: string | null,
): string | null {
  if (!device || device === stored) return null
  return !stored || stored === 'UTC' ? device : null
}
