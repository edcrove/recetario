/** Short Spanish notes explaining why a suggestion ranks where it does. */
export function suggestionNotes(r: {
  usesExpiring?: string[]
  recentlyCooked?: boolean
  avgRating?: number | null
}): string[] {
  const notes: string[] = []
  if (r.usesExpiring?.length) notes.push(`Aprovechá lo que vence: ${r.usesExpiring.join(', ')}`)
  if (r.avgRating != null) notes.push(`★ ${r.avgRating.toFixed(1)}`)
  if (r.recentlyCooked) notes.push('La cocinaste hace poco')
  return notes
}
