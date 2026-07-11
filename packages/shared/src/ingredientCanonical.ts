import { normalizeIngredientName } from './ingredientName.js'

/**
 * Ingredient canonicalization (the deterministic pipeline the spec calls for:
 * lowercase → de-accent → singularize → strip presentation → synonym lookup →
 * canonical, or passthrough). The string stages live here (pure); the synonym →
 * canonical lookup is fed a map by the API, which owns the curated data.
 *
 * "Presentations" are physical forms (picado, rallado, en cubos) — they are not
 * part of the ingredient identity, so they are removed before matching. The
 * connector "de" is preserved, since it distinguishes real ingredients
 * ("pata de pollo" ≠ "pollo").
 */

// Masculine-singular (or non-gendered) presentation words. Matching also
// accepts the feminine "-a" form (rallada→rallado), and singularizeWord has
// already undone plurals upstream.
export const PRESENTATION_WORDS: ReadonlySet<string> = new Set([
  'picado',
  'rallado',
  'molido',
  'fileteado',
  'cortado',
  'trozado',
  'cubeteado',
  'laminado',
  'triturado',
  'rebanado',
  'desmenuzado',
  'deshuesado',
  'pelado',
  'cocido',
  'crudo',
  'hervido',
  'frito',
  'asado',
  'grillado',
  'salteado',
  'tostado',
  'fresco',
  'seco',
  'congelado',
  'descongelado',
  'maduro',
  'entero',
  'juliana',
  'polvo',
  'cubo',
  'rodaja',
  'tira',
  'gajo',
  'trozo',
  'baston',
  'natural',
])

function isPresentation(token: string): boolean {
  return PRESENTATION_WORDS.has(token) || PRESENTATION_WORDS.has(token.replace(/a$/, 'o'))
}

// Multi-word presentation phrases (stored singular/de-accented). Removed before
// the single-word pass so their connector ("en", "a la") doesn't linger.
const PRESENTATION_PHRASES = [
  'a la juliana',
  'en juliana',
  'en cubo',
  'en rodaja',
  'en tira',
  'en gajo',
  'en trozo',
  'en baston',
  'en polvo',
  'al natural',
  'en lata',
  'en conserva',
]

// Connectors that can be left orphaned once a presentation phrase/word is cut.
// "de" is intentionally NOT here — it carries meaning ("pata de pollo").
const ORPHAN_CONNECTORS: ReadonlySet<string> = new Set(['en', 'a', 'al', 'la'])

/** Removes presentation words/phrases from an already-normalized name. */
export function stripPresentation(normalized: string): string {
  let s = ` ${normalized} `
  for (const phrase of PRESENTATION_PHRASES) {
    s = s.replace(` ${phrase} `, ' ')
  }
  const tokens = s
    .trim()
    .split(/\s+/)
    .filter((t) => t && !isPresentation(t))
  // Drop connectors only if they were left stranded (i.e. something else remains).
  const kept = tokens.filter((t) => !ORPHAN_CONNECTORS.has(t))
  return (kept.length > 0 ? kept : tokens).join(' ')
}

/** Full normalization key: normalizeIngredientName + presentation stripping. */
export function normalizeIngredientKey(name: string): string {
  return stripPresentation(normalizeIngredientName(name))
}

export interface CanonicalResolution {
  /** Grouping/matching key: the canonical name, or the normalized surface if unmatched. */
  key: string
  /** True when the name resolved to a known synonym or canonical. */
  matched: boolean
}

/**
 * Resolves a raw ingredient name to its canonical key using the provided maps.
 * `synonyms` maps normalized synonym → canonical name; `canonicals` is the set
 * of normalized canonical names. Unknown names pass through as their own key.
 */
export function resolveCanonical(
  name: string,
  synonyms: ReadonlyMap<string, string>,
  canonicals: ReadonlySet<string>,
): CanonicalResolution {
  const key = normalizeIngredientKey(name)
  const synonym = synonyms.get(key)
  if (synonym !== undefined) return { key: synonym, matched: true }
  if (canonicals.has(key)) return { key, matched: true }
  return { key, matched: false }
}
