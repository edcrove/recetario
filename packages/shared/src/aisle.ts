import { normalizeIngredientName } from './ingredientName.js'

/**
 * Supermarket aisle an ingredient belongs to, for grouping the shopping list.
 * Argentine grocery vernacular (verdulería, fiambrería, almacén…). Matching is
 * a static keyword table — deterministic, no inference — with an "otros"
 * fallback so every item lands somewhere.
 */
export type Aisle =
  | 'verduleria'
  | 'carniceria'
  | 'pescaderia'
  | 'fiambreria'
  | 'lacteos'
  | 'panaderia'
  | 'almacen'
  | 'congelados'
  | 'bebidas'
  | 'limpieza'
  | 'otros'

/** Display order for the sectioned list — "otros" is always last. */
export const AISLE_ORDER: Aisle[] = [
  'verduleria',
  'carniceria',
  'pescaderia',
  'fiambreria',
  'lacteos',
  'panaderia',
  'almacen',
  'congelados',
  'bebidas',
  'limpieza',
  'otros',
]

export const AISLE_LABELS: Record<Aisle, string> = {
  verduleria: 'Verdulería',
  carniceria: 'Carnicería',
  pescaderia: 'Pescadería',
  fiambreria: 'Fiambrería',
  lacteos: 'Lácteos',
  panaderia: 'Panadería',
  almacen: 'Almacén',
  congelados: 'Congelados',
  bebidas: 'Bebidas',
  limpieza: 'Limpieza',
  otros: 'Otros',
}

// Keywords are stored already normalized (via normalizeIngredientName), so a
// recipe's "Tomates" matches "tomate" here. Single-word keywords match whole
// tokens; multi-word keywords match as a substring of the normalized name.
const KEYWORDS: Record<Exclude<Aisle, 'otros'>, string[]> = {
  verduleria: [
    'tomate',
    'cebolla',
    'ajo',
    'manzana',
    'limon',
    'lechuga',
    'zanahoria',
    'papa',
    'morron',
    'pimiento',
    'zapallo',
    'zapallito',
    'verde',
    'banana',
    'naranja',
    'frutilla',
    'espinaca',
    'apio',
    'pepino',
    'palta',
    'choclo',
    'brocoli',
    'coliflor',
    'berenjena',
    'pera',
    'durazno',
    'perejil',
    'albahaca',
    'jengibre',
    'batata',
    'remolacha',
    'rucula',
    'puerro',
    'hongo',
    'champinon',
  ],
  carniceria: [
    'carne',
    'pollo',
    'cerdo',
    'bife',
    'milanesa',
    'chorizo',
    'salchicha',
    'pechuga',
    'nalga',
    'peceto',
    'vacio',
    'cordero',
    'costilla',
    'matambre',
    'bondiola',
    'molida',
    'pata',
    'muslo',
  ],
  pescaderia: [
    'merluza',
    'camaron',
    'atun',
    'salmon',
    'pescado',
    'langostino',
    'calamar',
    'mejillon',
    'trucha',
  ],
  fiambreria: ['jamon', 'salame', 'mortadela', 'panceta', 'fiambre', 'salamin', 'lomito'],
  lacteos: [
    'leche',
    'queso',
    'yogur',
    'manteca',
    'crema',
    'ricota',
    'muzzarella',
    'mozzarella',
    'dulce de leche',
  ],
  panaderia: ['pan', 'factura', 'medialuna', 'bizcocho', 'tostada', 'prepizza'],
  almacen: [
    'harina',
    'arroz',
    'aceite',
    'azucar',
    'sal',
    'fideo',
    'pasta',
    'polenta',
    'lenteja',
    'garbanzo',
    'huevo',
    'yerba',
    'cafe',
    'te',
    'galletita',
    'pure',
    'avena',
    'mermelada',
    'miel',
    'vinagre',
    'caldo',
    'pimienta',
    'oregano',
    'comino',
    'canela',
    'levadura',
    'cacao',
    'chocolate',
    'mayonesa',
    'mostaza',
    'ketchup',
    'salsa',
    'pan rallado',
    'coco',
    'nuez',
    'almendra',
    'pasas',
  ],
  congelados: ['congelado', 'congelada', 'helado'],
  bebidas: ['vino', 'cerveza', 'agua', 'gaseosa', 'jugo', 'soda', 'fernet', 'aperitivo'],
  limpieza: [
    'detergente',
    'lavandina',
    'jabon',
    'esponja',
    'papel',
    'servilleta',
    'lampazo',
    'desodorante',
  ],
}

// Modifier-style aisles (congelados, limpieza) win over the base ingredient so
// "arvejas congeladas" lands in Congelados, not Verdulería.
const MATCH_PRIORITY: Exclude<Aisle, 'otros'>[] = [
  'limpieza',
  'congelados',
  'pescaderia',
  'carniceria',
  'fiambreria',
  'lacteos',
  'panaderia',
  'bebidas',
  'verduleria',
  'almacen',
]

export function ingredientAisle(name: string): Aisle {
  const norm = normalizeIngredientName(name)
  if (!norm) return 'otros'
  const tokens = new Set(norm.split(' '))
  for (const aisle of MATCH_PRIORITY) {
    for (const kw of KEYWORDS[aisle]) {
      const hit = kw.includes(' ') ? norm.includes(kw) : tokens.has(kw)
      if (hit) return aisle
    }
  }
  return 'otros'
}
