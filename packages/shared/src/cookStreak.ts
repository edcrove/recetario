/** Calendar-date arithmetic on YYYY-MM-DD strings (UTC, so no DST drift). */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface CookingStreak {
  /** Consecutive days with at least one cook, up to today (or yesterday). */
  current: number
  /** The longest such run ever. */
  longest: number
}

/**
 * Cooking streak from the distinct local dates the person cooked on.
 * A streak that reached yesterday is still alive today (there is still time
 * to cook), so it only breaks after a whole day without cooking. Pure.
 */
export function cookingStreak(cookDays: string[], today: string): CookingStreak {
  const days = new Set(cookDays)
  let longest = 0
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue // not the start of a run
    let run = 1
    while (days.has(addDays(day, run))) run++
    longest = Math.max(longest, run)
  }

  let from = today
  if (!days.has(from)) from = addDays(today, -1)
  let current = 0
  while (days.has(addDays(from, -current))) current++

  return { current, longest }
}
