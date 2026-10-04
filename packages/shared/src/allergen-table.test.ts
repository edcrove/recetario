import { describe, it, expect } from 'vitest'
import { ALLERGENS, ALLERGEN_LABELS, ingredientHasAllergen, toAllergenKey } from './allergen.js'

// The allergen table is safety data: a term that silently drops out means a
// recipe with that ingredient stops warning someone who is allergic to it.
// Mutation testing (2026-10-01) showed whole allergens (pescado, soja, maní…)
// could be emptied without any test failing, so every curated term and false
// friend is pinned here as an independent oracle.
const EXPECTED: Record<(typeof ALLERGENS)[number], { contains: string[]; notContains?: string[] }> =
  {
    gluten: {
      contains: [
        'gluten',
        'trigo',
        'harina',
        'pan',
        'pan rallado',
        'fideos',
        'tallarines',
        'spaghetti',
        'espagueti',
        'ravioles',
        'ñoquis',
        'pasta',
        'cebada',
        'centeno',
        'avena',
        'espelta',
        'kamut',
        'sémola',
        'galletitas',
        'galleta',
        'bizcochuelo',
        'vainillas',
        'masa',
        'tapa de empanada',
        'tapa de tarta',
        'rebozador',
        'cerveza',
        'malta',
        'seitán',
        'cuscús',
        'bulgur',
      ],
      notContains: [
        'harina de maíz',
        'harina de arroz',
        'harina de almendra',
        'harina de garbanzo',
        'harina de mandioca',
        'harina de coco',
        'harina sin TACC',
        'pan sin TACC',
        'fideos de arroz',
        'pasta de maní',
        'pasta de tomate',
        'pasta de membrillo',
        'pasta de batata',
        'pasta de sésamo',
        'esencia de vainilla',
        'extracto de vainilla',
        'chaucha de vainilla',
        'vaina de vainilla',
        // Auditar 2026-10-03: free-from labels and false friends
        'vainilla',
        'azúcar vainillada',
        'fideos sin TACC',
        'galletitas sin TACC',
        'pasta sin gluten',
        'rebozador sin TACC',
        'premezcla libre de gluten',
        'trigo sarraceno',
        'alforfón',
        'pasta de aceitunas',
      ],
    },
    leche: {
      contains: [
        'leche',
        'lácteos',
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
        'requesón',
        'dulce de leche',
        'suero',
        'caseína',
        'ghee',
        'chantilly',
      ],
      notContains: [
        'leche de coco',
        'leche de almendra',
        'leche de avena',
        'leche de arroz',
        'leche de soja',
        'crema de coco',
        'crema vegetal',
        'queso vegano',
        'manteca de maní',
        'manteca de cacahuate',
        'manteca de cacahuete',
        'manteca de cacao',
        'manteca vegetal',
      ],
    },
    huevo: { contains: ['huevos', 'claras', 'yemas', 'mayonesa', 'merengue', 'albúmina'] },
    pescado: {
      contains: [
        'pescado',
        'atún',
        'salmón',
        'merluza',
        'bacalao',
        'anchoas',
        'sardinas',
        'caballa',
        'trucha',
        'abadejo',
        'lenguado',
        'pejerrey',
        'surimi',
      ],
    },
    crustaceos: {
      contains: [
        'crustáceos',
        'mariscos',
        'langostinos',
        'camarones',
        'gambas',
        'cangrejo',
        'langosta',
        'centolla',
      ],
    },
    moluscos: {
      contains: [
        'moluscos',
        'mariscos',
        'mejillones',
        'almejas',
        'calamar',
        'rabas',
        'pulpo',
        'ostras',
        'vieiras',
        'berberechos',
        'sepia',
        'caracoles',
      ],
    },
    mani: { contains: ['maní', 'maníes', 'cacahuate', 'cacahuete'] },
    frutos_secos: {
      contains: [
        'nueces',
        'nogal',
        'almendras',
        'avellanas',
        'castañas de cajú',
        'cajú',
        'anacardos',
        'pistachos',
        'pecán',
        'macadamia',
      ],
      notContains: ['nuez moscada'],
    },
    soja: { contains: ['soja', 'soya', 'tofu', 'edamame', 'miso', 'tempeh'] },
    sesamo: { contains: ['sésamo', 'ajonjolí', 'tahini', 'tahina'] },
    apio: { contains: ['apio'] },
    mostaza: { contains: ['mostaza'] },
    sulfitos: { contains: ['sulfitos', 'metabisulfito', 'vino blanco'] },
    altramuces: { contains: ['altramuces', 'lupino', 'lupin'] },
  }

describe('allergen table (every curated term, every false friend)', () => {
  it('covers exactly the 14 allergens', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ALLERGENS].sort())
  })

  for (const allergen of ALLERGENS) {
    const { contains, notContains = [] } = EXPECTED[allergen]
    it.each(contains)(`${allergen}: "%s" contains it`, (ingredient) => {
      expect(ingredientHasAllergen(ingredient, allergen)).toBe(true)
    })
    if (notContains.length > 0) {
      it.each(notContains)(`${allergen}: "%s" does not`, (ingredient) => {
        expect(ingredientHasAllergen(ingredient, allergen)).toBe(false)
      })
    }
    it(`${allergen}: its label maps back to the key`, () => {
      expect(toAllergenKey(ALLERGEN_LABELS[allergen])).toBe(allergen)
    })
  }

  it('one empty side is enough to say no', () => {
    expect(ingredientHasAllergen('', 'leche')).toBe(false)
    expect(ingredientHasAllergen('leche entera', '')).toBe(false)
  })
})
