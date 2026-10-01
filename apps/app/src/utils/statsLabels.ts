import { addDays } from './weekMath'

/** Display name for a top-cooked recipe: its title snapshot, flagged when deleted. */
export function topRecipeLabel(r: { recipeId: string | null; title: string | null }): string {
  const title = r.title?.trim() || 'Receta'
  return r.recipeId ? title : `${title} (eliminada)`
}

/** "desde el 3 jul" — the window every stats figure covers. */
export function statsWindowLabel(since: string): string {
  const d = new Date(since + 'T00:00:00Z')
  const date = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `desde el ${date}`
}

/** "3 días seguidos" — the current cooking streak. */
export function streakLabel(days: number): string {
  return days === 1 ? '1 día seguido' : `${days} días seguidos`
}

/**
 * The weekly bars to draw: every week from the first one with data (or
 * `minWeeks` back, whichever is earlier) up to the current week, empty weeks
 * included as 0 — so the chart always spans at least `minWeeks` weeks and
 * gaps read as gaps. Weeks are Monday dates (YYYY-MM-DD), like the API's.
 */
export function chartWeeks(
  frequency: { week: string; count: number }[],
  currentWeek: string,
  minWeeks = 8,
): { week: string; count: number }[] {
  const counts = new Map(frequency.map((w) => [w.week, w.count]))
  let first = addDays(currentWeek, -7 * (minWeeks - 1))
  for (const w of frequency) if (w.week < first) first = w.week
  const weeks: { week: string; count: number }[] = []
  for (let week = first; week <= currentWeek; week = addDays(week, 7)) {
    weeks.push({ week, count: counts.get(week) ?? 0 })
  }
  return weeks
}

/** "29 sept" for a week's Monday; formatted in UTC so UTC-3 doesn't show Sunday. */
export function weekLabel(week: string): string {
  return new Date(week + 'T00:00:00Z').toLocaleDateString('es-AR', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
