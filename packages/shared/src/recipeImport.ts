/**
 * Deterministic schema.org/JSON-LD Recipe extraction — no inference. The
 * agent calls the MCP fetch_recipe_page tool, this normalizes whatever
 * structured markup the page has into agent-friendly fields, and the agent
 * then maps them into create_recipe (or falls back to reading cleaned text
 * when a page has no markup).
 */

export interface ParsedRecipe {
  title?: string
  ingredients: string[]
  steps: string[]
  prepTimeMin?: number
  cookTimeMin?: number
  totalTimeMin?: number
  servings?: number
  imageUrl?: string
  author?: string
  nutrition?: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    fiber_g?: number
  }
}

/** ISO 8601 duration (PT1H30M) → minutes. Returns undefined if unparseable. */
export function parseIsoDuration(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(value.trim())
  if (!m || (!m[1] && !m[2])) return undefined
  return (m[1] ? parseInt(m[1], 10) * 60 : 0) + (m[2] ? parseInt(m[2], 10) : 0)
}

/**
 * First number in a schema.org value ("420 kcal", "1,200 calories", "12,5 g").
 * A separator followed by exactly three digits and no other separator is a
 * thousands separator ("1,200" / "1.200" → 1200); otherwise "," is a decimal
 * comma ("12,5" → 12.5). With both, the last one is the decimal ("1.200,5").
 */
export function firstNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const m = /\d[\d.,]*/.exec(value)
  if (!m) return undefined
  let raw = m[0].replace(/[.,]$/, '')
  const lastDot = raw.lastIndexOf('.')
  const lastComma = raw.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ','
    const thousands = decimal === '.' ? ',' : '.'
    raw = raw.split(thousands).join('').replace(decimal, '.')
  } else if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) {
    raw = raw.replace(/[.,]/g, '')
  } else {
    raw = raw.replace(',', '.')
  }
  // raw starts with a digit (regex above), so this is always a finite number
  return parseFloat(raw)
}

/** Energy in kcal; values given in kJ ("1800 kJ") are converted. */
function energyKcal(value: unknown): number | undefined {
  const n = firstNumber(value)
  if (n === undefined) return undefined
  const isKj = typeof value === 'string' && /kj\b/i.test(value) && !/kcal/i.test(value)
  return isKj ? Math.round(n / 4.184) : n
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (value && typeof value === 'object' && 'name' in value) {
    const n = (value as { name?: unknown }).name
    if (typeof n === 'string') return n.trim() || undefined
  }
  return undefined
}

function collectSteps(instructions: unknown): string[] {
  if (typeof instructions === 'string') {
    return instructions
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (!Array.isArray(instructions)) return []
  const out: string[] = []
  for (const item of instructions) {
    if (typeof item === 'string') {
      const t = item.trim()
      if (t) out.push(t)
    } else if (item && typeof item === 'object') {
      const obj = item as { '@type'?: string; text?: unknown; itemListElement?: unknown }
      // HowToSection nests HowToSteps under itemListElement
      if (obj.itemListElement) {
        out.push(...collectSteps(obj.itemListElement))
      } else if (typeof obj.text === 'string') {
        const t = obj.text.trim()
        if (t) out.push(t)
      }
    }
  }
  return out
}

function typeMatchesRecipe(t: unknown): boolean {
  if (t === 'Recipe') return true
  if (Array.isArray(t)) return t.includes('Recipe')
  return false
}

/** Finds the Recipe node in a parsed JSON-LD value (handles @graph and arrays). */
function findRecipeNode(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object') return null
  if (Array.isArray(json)) {
    for (const item of json) {
      const found = findRecipeNode(item)
      if (found) return found
    }
    return null
  }
  const obj = json as Record<string, unknown>
  if (typeMatchesRecipe(obj['@type'])) return obj
  if (obj['@graph']) return findRecipeNode(obj['@graph'])
  return null
}

function normalizeImage(image: unknown): string | undefined {
  if (typeof image === 'string') return image
  if (Array.isArray(image)) return normalizeImage(image[0])
  if (image && typeof image === 'object' && 'url' in image) {
    const u = (image as { url?: unknown }).url
    if (typeof u === 'string') return u
  }
  return undefined
}

function normalizeNutrition(n: unknown): ParsedRecipe['nutrition'] {
  if (!n || typeof n !== 'object') return undefined
  const o = n as Record<string, unknown>
  const out = {
    calories: energyKcal(o['calories']),
    protein_g: firstNumber(o['proteinContent']),
    carbs_g: firstNumber(o['carbohydrateContent']),
    fat_g: firstNumber(o['fatContent']),
    fiber_g: firstNumber(o['fiberContent']),
  }
  if (!Object.values(out).some((v) => v !== undefined)) return undefined
  // Only report fiber when the source gives it (keeps the shape stable otherwise)
  if (out.fiber_g === undefined) delete out.fiber_g
  return out
}

/** Extracts every JSON-LD block from an HTML string and returns the first Recipe. */
export function parseRecipeFromHtml(html: string): ParsedRecipe | null {
  // One unbounded run for the opening tag's attributes and a tempered token for
  // the body keeps this linear (no polynomial-ReDoS on hostile input) and lets
  // the close tag carry trailing whitespace ("</script >"). The ld+json check
  // runs on the captured attribute string rather than inside the tag pattern.
  const scriptRe = /<script\b([^>]*)>((?:[^<]|<(?!\/script[\s/>]))*)<\/script(?=[\s/>])[^>]*>/gi
  const blocks = [...html.matchAll(scriptRe)]
  for (const block of blocks) {
    const attrs = block[1]
    if (!attrs || !/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue
    const raw = block[2]
    if (!raw) continue
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      continue
    }
    const node = findRecipeNode(json)
    if (!node) continue

    const ingredients = Array.isArray(node['recipeIngredient'])
      ? (node['recipeIngredient'] as unknown[]).map((i) => String(i).trim()).filter(Boolean)
      : []
    const steps = collectSteps(node['recipeInstructions'])

    const parsed: ParsedRecipe = {
      title: asText(node['name']),
      ingredients,
      steps,
      prepTimeMin: parseIsoDuration(node['prepTime']),
      cookTimeMin: parseIsoDuration(node['cookTime']),
      totalTimeMin: parseIsoDuration(node['totalTime']),
      servings: firstNumber(node['recipeYield']),
      imageUrl: normalizeImage(node['image']),
      author: asText(node['author']),
      nutrition: normalizeNutrition(node['nutrition']),
    }
    return parsed
  }
  return null
}

/** Strips tags/scripts/styles from HTML for the agent's text fallback. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>(?:[^<]|<(?!\/script[\s/>]))*<\/script(?=[\s/>])[^>]*>/gi, ' ')
    .replace(/<style\b[^>]*>(?:[^<]|<(?!\/style[\s/>]))*<\/style(?=[\s/>])[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
