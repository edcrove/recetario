/**
 * The calendar date (YYYY-MM-DD) of `date` in the device's time zone. Using
 * toISOString() instead gives the UTC date, which in Argentina is already
 * "tomorrow" from 21:00 — Sunday night jumped the planner a week ahead.
 */
export function localIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Monday of the local week containing `date`, as YYYY-MM-DD. */
export function getWeekStart(date: Date): string {
  const d = new Date(localIsoDate(date) + 'T00:00:00Z')
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  return d.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}
