export interface CanonicalItem {
  id: string
  name: string
  familyName: string | null
  isSystem: boolean
  synonyms: { id: string; synonym: string; isSystem: boolean }[]
}

export interface FamilyGroup {
  family: string
  canonicals: CanonicalItem[]
}

const NO_FAMILY = 'Sin familia'

/**
 * Filters canonicals by a free-text query (matched against the canonical name
 * or any of its synonyms) and groups the survivors by family, alphabetically,
 * with the "Sin familia" bucket always last.
 */
export function groupCanonicals(items: CanonicalItem[], search: string): FamilyGroup[] {
  const q = search.trim().toLowerCase()
  const filtered = q
    ? items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.synonyms.some((s) => s.synonym.toLowerCase().includes(q)),
      )
    : items

  const byFamily = new Map<string, CanonicalItem[]>()
  for (const c of filtered) {
    const key = c.familyName ?? NO_FAMILY
    const list = byFamily.get(key)
    if (list) list.push(c)
    else byFamily.set(key, [c])
  }

  return [...byFamily.entries()]
    .map(([family, canonicals]) => ({
      family,
      canonicals: [...canonicals].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (a.family === NO_FAMILY) return 1
      if (b.family === NO_FAMILY) return -1
      return a.family.localeCompare(b.family)
    })
}
