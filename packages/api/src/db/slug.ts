/** "Comida Rápida" → "comida-rpida": lowercase, dashes, ASCII only. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/** True when a slug has at least one usable character (not only dashes). */
export function isUsableSlug(slug: string): boolean {
  return /[a-z0-9]/.test(slug)
}

/** Tag spellings with a usable slug, trimmed, one per slug (first spelling wins). */
export function tagEntries(names: string[]): { name: string; slug: string }[] {
  const seen = new Map<string, string>()
  for (const raw of names) {
    const name = raw.trim()
    const slug = slugify(name)
    if (isUsableSlug(slug) && !seen.has(slug)) seen.set(slug, name)
  }
  return [...seen].map(([slug, name]) => ({ name, slug }))
}

/**
 * Replaces the spelling(s) of the tag `fromSlug` with `toName` (or drops them
 * when null), keeping one spelling per slug. Pure, for rename/merge/delete.
 */
export function replaceTag(tags: string[], fromSlug: string, toName: string | null): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const tag of tags) {
    const next = slugify(tag.trim()) === fromSlug ? toName : tag
    if (next === null) continue
    const slug = slugify(next.trim())
    if (seen.has(slug)) continue
    seen.add(slug)
    out.push(next)
  }
  return out
}
