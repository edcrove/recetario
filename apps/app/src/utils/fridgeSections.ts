export interface Suggestion {
  id: string
  title: string
  matchedCount: number
  totalCount: number
  matchFraction: number
  missingIngredients: string[]
  goalFit: 'dentro' | 'cerca' | 'lejos' | null
  nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null
}

export interface SuggestionSections {
  /** Everything on hand — cook right now. */
  cookable: Suggestion[]
  /** Missing just 1–2 ingredients. */
  almost: Suggestion[]
}

/**
 * Splits ranked suggestions into the two plain buckets the screen shows:
 * "Podés cocinar ya" (nothing missing) and "Te falta poco" (1–2 missing).
 * Recipes missing 3+ ingredients are dropped — they aren't useful "cook now"
 * answers. Recipes with no ingredients at all are also dropped.
 */
export function splitSuggestions(suggestions: Suggestion[]): SuggestionSections {
  const cookable: Suggestion[] = []
  const almost: Suggestion[] = []
  for (const s of suggestions) {
    if (s.totalCount === 0) continue
    if (s.missingIngredients.length === 0) cookable.push(s)
    else if (s.missingIngredients.length <= 2) almost.push(s)
  }
  return { cookable, almost }
}
