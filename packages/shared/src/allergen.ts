import { z } from 'zod'
import { normalizeIngredientKey } from './ingredientCanonical.js'

/**
 * The 14 major allergens (EU Reg. 1169/2011 / Codex), as stable keys shared by
 * the API, the MCP tools and the app. A user's profile stores these keys.
 */
export const ALLERGENS = [
  'gluten',
  'leche',
  'huevo',
  'pescado',
  'crustaceos',
  'moluscos',
  'mani',
  'frutos_secos',
  'soja',
  'sesamo',
  'apio',
  'mostaza',
  'sulfitos',
  'altramuces',
] as const
export type Allergen = (typeof ALLERGENS)[number]
export const AllergenSchema = z.enum(ALLERGENS)

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: 'Gluten (TACC)',
  leche: 'Leche y lácteos',
  huevo: 'Huevo',
  pescado: 'Pescado',
  crustaceos: 'Crustáceos',
  moluscos: 'Moluscos',
  mani: 'Maní',
  frutos_secos: 'Frutos secos',
  soja: 'Soja',
  sesamo: 'Sésamo',
  apio: 'Apio',
  mostaza: 'Mostaza',
  sulfitos: 'Sulfitos',
  altramuces: 'Altramuces',
}

/**
 * Curated Spanish (Rioplatense first) ingredient terms that contain each
 * allergen, plus phrases that look like a match but are not (nuez moscada,
 * leche de coco). The allergen check runs client-side with no DB access, so
 * this table is pure and ships to the app. Written naturally; normalized below.
 */
const ALLERGEN_TERMS: Record<Allergen, { terms: string[]; except?: string[] }> = {
  gluten: {
    terms: [
      'gluten',
      'trigo',
      'harina',
      'pan',
      'pan rallado',
      'fideo',
      'tallarin',
      'spaghetti',
      'espagueti',
      'raviol',
      'ñoqui',
      'pasta',
      'cebada',
      'centeno',
      'avena',
      'espelta',
      'kamut',
      'semola',
      'galletita',
      'galleta',
      'bizcochuelo',
      'masa',
      'tapa de empanada',
      'tapa de tarta',
      'rebozador',
      'cerveza',
      'malta',
      'seitan',
      'cuscus',
      'bulgur',
      // Brewed soy sauce is made with wheat (tamari usually too)
      'salsa de soja',
      'shoyu',
      'tamari',
    ],
    except: [
      'harina de maiz',
      'harina de arroz',
      'harina de almendra',
      'harina de garbanzo',
      'harina de mandioca',
      'harina de coco',
      'harina sin tacc',
      'pan sin tacc',
      'fideo de arroz',
      'pasta de mani',
      'pasta de tomate',
      'pasta de membrillo',
      'pasta de batata',
      'pasta de sesamo',
      'pasta de aceituna',
      'trigo sarraceno',
    ],
  },
  leche: {
    terms: [
      'leche',
      'lacteo',
      'manteca',
      'mantequilla',
      'queso',
      'yogur',
      'yogurt',
      'crema',
      'nata',
      'ricota',
      'ricotta',
      'mozzarella',
      'muzzarella',
      'parmesano',
      'reggianito',
      'provolone',
      'roquefort',
      'mascarpone',
      'requeson',
      'dulce de leche',
      'suero',
      'caseina',
      'ghee',
      'chantilly',
      'caseinato',
      'bechamel',
      'besamel',
    ],
    except: [
      'leche de coco',
      'leche de almendra',
      'leche de avena',
      'leche de arroz',
      'leche de soja',
      'crema de coco',
      'crema vegetal',
      'queso vegano',
      'manteca de mani',
      'manteca de cacahuate',
      'manteca de cacahuete',
      'manteca de cacao',
      'manteca vegetal',
    ],
  },
  huevo: {
    terms: ['huevo', 'clara', 'yema', 'mayonesa', 'merengue', 'albumina', 'alioli'],
    except: ['mayonesa vegana'],
  },
  pescado: {
    terms: [
      'pescado',
      'atun',
      'salmon',
      'merluza',
      'bacalao',
      'anchoa',
      'sardina',
      'caballa',
      'trucha',
      'abadejo',
      'lenguado',
      'pejerrey',
      'surimi',
      'kani kama',
      'kanikama',
      'corvina',
      'brotola',
      'mero',
      'boqueron',
      'bonito',
      'pez espada',
      'pez',
      // Worcestershire sauce is made with anchovies
      'salsa inglesa',
      'worcestershire',
    ],
  },
  crustaceos: {
    terms: [
      'crustaceo',
      'marisco',
      'langostino',
      'camaron',
      'gamba',
      'cangrejo',
      'langosta',
      'centolla',
      'cigala',
      'bogavante',
      'krill',
    ],
  },
  moluscos: {
    terms: [
      'molusco',
      'marisco',
      'mejillon',
      'almeja',
      'calamar',
      'rabas',
      'pulpo',
      'ostra',
      'vieira',
      'berberecho',
      'sepia',
      'caracol',
      'chipiron',
      'navaja',
    ],
  },
  // "maníes" singularizes to "manie", so the plural is listed too.
  mani: { terms: ['mani', 'manies', 'cacahuate', 'cacahuete', 'garrapiñada'] },
  frutos_secos: {
    terms: [
      'nuez',
      'nogal',
      'almendra',
      'avellana',
      'castaña de caju',
      'caju',
      'anacardo',
      'pistacho',
      'pecan',
      'macadamia',
      'mazapan',
      'turron',
      'praline',
      'nougat',
    ],
    except: ['nuez moscada'],
  },
  soja: { terms: ['soja', 'soya', 'tofu', 'edamame', 'miso', 'tempeh', 'shoyu', 'tamari'] },
  sesamo: { terms: ['sesamo', 'ajonjoli', 'tahini', 'tahina'] },
  apio: { terms: ['apio'] },
  mostaza: { terms: ['mostaza'] },
  sulfitos: { terms: ['sulfito', 'metabisulfito', 'vino'] },
  altramuces: { terms: ['altramuz', 'lupino', 'lupin'] },
}

const norm = (s: string) => normalizeIngredientKey(s)

/**
 * Phrases normalization would lose, matched on the accent-free, lowercased raw
 * name: "vainillas" (ladyfingers, wheat) would become "vainilla" (the spice),
 * and "frutos secos" would become "fruto" (as "frutos rojos" becomes "fruto rojo").
 */
const RAW_TERMS: Partial<Record<Allergen, string[]>> = {
  gluten: ['vainillas'],
  frutos_secos: ['frutos secos', 'fruto seco'],
}

/**
 * Labels that declare the product free of the allergen ("Fideos sin TACC",
 * "galletitas sin gluten"): such an ingredient never counts as containing it.
 * Every "sin <term>" is free-from too ("chocolate sin leche").
 */
const FREE_FROM_EXTRA: Partial<Record<Allergen, string[]>> = {
  gluten: ['sin tacc', 'libre de gluten', 'apto celiaco', 'apto para celiaco'],
  frutos_secos: ['sin frutos secos'],
}

interface NormalizedTerms {
  terms: string[]
  except: string[]
  freeFrom: string[]
}

const NORMALIZED: Record<Allergen, NormalizedTerms> = Object.fromEntries(
  ALLERGENS.map((a) => {
    const terms = ALLERGEN_TERMS[a].terms.map(norm)
    return [
      a,
      {
        terms,
        except: (ALLERGEN_TERMS[a].except ?? []).map(norm),
        freeFrom: [...terms.map((t) => `sin ${t}`), ...(FREE_FROM_EXTRA[a] ?? []).map(norm)],
      },
    ]
  }),
) as Record<Allergen, NormalizedTerms>

const plainLower = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

// Free-text names people (and older profiles) use for an allergen → its key.
const ALLERGEN_ALIASES: Record<string, Allergen> = {
  lacteos: 'leche',
  lacteo: 'leche',
  lactosa: 'leche',
  tacc: 'gluten',
  trigo: 'gluten',
  celiaquia: 'gluten',
  huevos: 'huevo',
  marisco: 'crustaceos',
  mariscos: 'crustaceos',
  crustaceo: 'crustaceos',
  molusco: 'moluscos',
  cacahuate: 'mani',
  cacahuete: 'mani',
  nuez: 'frutos_secos',
  nueces: 'frutos_secos',
  'frutos secos': 'frutos_secos',
  'fruto seco': 'frutos_secos',
  soya: 'soja',
  ajonjoli: 'sesamo',
  sulfito: 'sulfitos',
  altramuz: 'altramuces',
  lupino: 'altramuces',
}

const KEY_BY_NAME = new Map<string, Allergen>()
for (const a of ALLERGENS) {
  KEY_BY_NAME.set(norm(a.replace('_', ' ')), a)
  KEY_BY_NAME.set(norm(ALLERGEN_LABELS[a]), a)
}
for (const [alias, a] of Object.entries(ALLERGEN_ALIASES)) KEY_BY_NAME.set(norm(alias), a)

/** Maps a key, label or common Spanish name ("maní", "lácteos", "nueces") to its key. */
export function toAllergenKey(value: string): Allergen | null {
  if ((ALLERGENS as readonly string[]).includes(value)) return value as Allergen
  return KEY_BY_NAME.get(norm(value)) ?? null
}

/** Display label for a stored allergen; unknown legacy strings show as-is. */
export function allergenLabel(value: string): string {
  const key = toAllergenKey(value)
  return key ? ALLERGEN_LABELS[key] : value
}

/** Whole-word/phrase containment on space-padded normalized strings. */
const hasPhrase = (padded: string, phrase: string) =>
  phrase !== '' && padded.includes(` ${phrase} `)

/**
 * True when an ingredient contains the allergen. The ingredient is normalized
 * (case/accents/plurals/presentation); a free-from label ("sin TACC", "sin
 * leche") rules the allergen out; known false friends are cut out
 * ("nuez moscada", "leche de coco", "manteca de maní"), and then any curated
 * term must appear as a whole word or phrase — so "panceta" is not "pan".
 * An allergen outside the enum (legacy free text) matches as its own term.
 */
export function ingredientHasAllergen(ingredientName: string, allergen: string): boolean {
  const ing = norm(ingredientName)
  if (!ing || !allergen) return false
  const key = toAllergenKey(allergen)
  if (!key) return hasPhrase(` ${ing} `, norm(allergen))

  const { terms, except, freeFrom } = NORMALIZED[key]
  let padded = ` ${ing} `
  if (freeFrom.some((q) => hasPhrase(padded, q))) return false
  const raw = ` ${plainLower(ingredientName).replace(/[^a-z0-9ñ]+/g, ' ')} `
  if ((RAW_TERMS[key] ?? []).some((t) => raw.includes(` ${t} `))) return true
  for (const phrase of except) padded = padded.split(` ${phrase} `).join('  ')
  return terms.some((t) => hasPhrase(padded, t))
}

/**
 * Canonical form of a stored allergen list: known names become keys, unknown
 * legacy strings are kept (never silently dropped — they still match as text),
 * duplicates removed.
 */
export function normalizeAllergens(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => toAllergenKey(v) ?? v))]
}
