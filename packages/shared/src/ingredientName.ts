/**
 * Canonical key for matching ingredient names across recipes and shopping-list
 * check state. Deliberately conservative: it lowercases, strips accents, and
 * undoes the common Spanish plural forms so "Tomates" and "tomate" collide —
 * but it never tries to stem beyond plurals, because a wrong merge (two real
 * ingredients into one line) is worse for a shopper than a missed one.
 *
 * The result is a *key*, not a display string — callers keep the original name
 * for display and use this only for grouping.
 */

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function singularizeWord(w: string): string {
  if (w.length <= 3) return w
  // luces → luz, nueces → nuez
  if (w.endsWith('ces')) return `${w.slice(0, -3)}z`
  // limones → limon, panes → pan, flores → flor (consonant + "es" plural)
  if (w.length > 4 && /[lnrdj]es$/.test(w)) return w.slice(0, -2)
  // tomates → tomate, papas → papa (vowel + "s" plural)
  if (/[aeiou]s$/.test(w)) return w.slice(0, -1)
  return w
}

export function normalizeIngredientName(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeWord)
    .join(' ')
}
