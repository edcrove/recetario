/**
 * Extended demo seed with rich Spanish recipes for local testing.
 * Run: tsx --env-file=.env src/scripts/seed-demo-data.ts <jwt-token>
 */

const BASE_URL = process.env['API_URL'] ?? 'http://localhost:3000'
const TOKEN = process.argv[2] ?? process.env['DEMO_TOKEN'] ?? ''

if (!TOKEN) {
  console.error('Usage: tsx seed-demo-data.ts <jwt-token>')
  console.error('Or set DEMO_TOKEN env var')
  process.exit(1)
}

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

const RECIPES = [
  {
    title: 'Milanesa de pollo napolitana',
    servings: 4,
    category: 'Cena',
    tags: ['pollo', 'argentina', 'rápida'],
    totalTimeMin: 35,
    dietaryTags: [],
    nutrition: { calories: 480, protein_g: 42, carbs_g: 28, fat_g: 20 },
    ingredients: [
      { name: 'Pechugas de pollo', quantity: 800, unit: 'g' },
      { name: 'Pan rallado', quantity: 200, unit: 'g' },
      { name: 'Huevos', quantity: 2, unit: null },
      { name: 'Ajo', quantity: 2, unit: 'clove' },
      { name: 'Salsa de tomate', quantity: 200, unit: 'ml' },
      { name: 'Jamón cocido', quantity: 150, unit: 'g' },
      { name: 'Queso mozzarella', quantity: 200, unit: 'g' },
      { name: 'Sal y pimienta', quantity: null, unit: null },
      { name: 'Aceite de girasol', quantity: 100, unit: 'ml' },
    ],
    steps: [
      { text: 'Aplanar las pechugas con un mazo de cocina hasta 1 cm de grosor.' },
      { text: 'Batir los huevos con ajo picado, sal y pimienta.' },
      { text: 'Pasar las pechugas por huevo batido y luego por pan rallado.' },
      { text: 'Freír en aceite caliente 3-4 minutos por lado hasta dorar.', durationMin: 8 },
      { text: 'Colocar en bandeja, cubrir con salsa, jamón y queso.' },
      {
        text: 'Gratinar en horno a 200°C por 10 minutos hasta fundir el queso.',
        durationMin: 10,
        ovenTempC: 200,
      },
    ],
    notes: 'Servir con puré de papas o ensalada mixta.',
  },
  {
    title: 'Empanadas de carne criollas',
    servings: 6,
    category: 'Almuerzo',
    tags: ['empanadas', 'argentina', 'tradicional'],
    totalTimeMin: 90,
    dietaryTags: [],
    nutrition: { calories: 320, protein_g: 18, carbs_g: 35, fat_g: 12 },
    ingredients: [
      { name: 'Tapas de empanadas', quantity: 24, unit: null },
      { name: 'Carne picada', quantity: 500, unit: 'g' },
      { name: 'Cebollas', quantity: 2, unit: null },
      { name: 'Cebolla de verdeo', quantity: 3, unit: null },
      { name: 'Huevos duros', quantity: 3, unit: null },
      { name: 'Aceitunas verdes', quantity: 100, unit: 'g' },
      { name: 'Pimentón dulce', quantity: 1, unit: 'tbsp' },
      { name: 'Comino', quantity: 0.5, unit: 'tsp' },
      { name: 'Sal y pimienta', quantity: null, unit: null },
    ],
    steps: [
      { text: 'Rehogar la cebolla en aceite hasta transparentar. Agregar la carne y dorar.' },
      {
        text: 'Condimentar con pimentón, comino, sal y pimienta. Cocinar 10 min.',
        durationMin: 10,
      },
      { text: 'Dejar enfriar completamente antes de usar el relleno.' },
      { text: 'Rellenar cada tapa con una cucharada del relleno, trozos de huevo y aceitunas.' },
      { text: 'Cerrar haciendo el repulgue característico.' },
      { text: 'Hornear a 200°C por 20 minutos hasta dorar.', durationMin: 20, ovenTempC: 200 },
    ],
    notes: 'El relleno puede prepararse el día anterior y refrigerar.',
  },
  {
    title: 'Guiso de lentejas',
    servings: 6,
    category: 'Almuerzo',
    tags: ['lentejas', 'legumbres', 'invierno', 'económico'],
    totalTimeMin: 60,
    dietaryTags: ['vegano', 'sin-gluten'],
    nutrition: { calories: 280, protein_g: 16, carbs_g: 42, fat_g: 5 },
    ingredients: [
      { name: 'Lentejas', quantity: 400, unit: 'g' },
      { name: 'Chorizo colorado', quantity: 200, unit: 'g' },
      { name: 'Papas', quantity: 3, unit: null },
      { name: 'Zanahorias', quantity: 2, unit: null },
      { name: 'Tomates perita', quantity: 2, unit: null },
      { name: 'Cebolla', quantity: 1, unit: null },
      { name: 'Pimiento rojo', quantity: 1, unit: null },
      { name: 'Ajo', quantity: 3, unit: 'clove' },
      { name: 'Caldo de verdura', quantity: 1.5, unit: 'l' },
      { name: 'Pimentón ahumado', quantity: 1, unit: 'tsp' },
      { name: 'Laurel', quantity: 2, unit: null },
    ],
    steps: [
      {
        text: 'Remojar las lentejas 30 minutos si son secas (omitir si son de lata).',
        durationMin: 30,
      },
      { text: 'Rehogar cebolla, pimiento y ajo. Agregar el chorizo en rodajas.' },
      { text: 'Incorporar tomate, pimentón y laurel. Cocinar 5 min.' },
      { text: 'Agregar lentejas escurridas, papas y zanahorias en cubos.' },
      { text: 'Cubrir con el caldo y cocinar 35-40 minutos a fuego medio.', durationMin: 40 },
      { text: 'Ajustar sal y servir bien caliente con pan crujiente.' },
    ],
  },
  {
    title: 'Tarta de verduras y queso',
    servings: 8,
    category: 'Cena',
    tags: ['tarta', 'vegetariano', 'para compartir'],
    totalTimeMin: 50,
    dietaryTags: ['vegetariano'],
    nutrition: { calories: 310, protein_g: 14, carbs_g: 30, fat_g: 16 },
    ingredients: [
      { name: 'Masa para tarta', quantity: 1, unit: null, note: 'comprada o casera' },
      { name: 'Espinaca', quantity: 500, unit: 'g' },
      { name: 'Cebolla', quantity: 2, unit: null },
      { name: 'Huevos', quantity: 3, unit: null },
      { name: 'Queso crema', quantity: 200, unit: 'g' },
      { name: 'Queso rallado', quantity: 150, unit: 'g' },
      { name: 'Nuez moscada', quantity: null, unit: null },
      { name: 'Sal y pimienta', quantity: null, unit: null },
    ],
    steps: [
      { text: 'Blanquear la espinaca, exprimir bien y picar.' },
      { text: 'Rehogar la cebolla en aceite hasta caramelizar.' },
      { text: 'Mezclar espinaca, cebolla, huevos, queso crema y mitad del queso rallado.' },
      { text: 'Condimentar con nuez moscada, sal y pimienta.' },
      { text: 'Forrar la tartera con la masa, volcar el relleno y cubrir con queso rallado.' },
      { text: 'Hornear a 180°C por 35-40 minutos hasta dorar.', durationMin: 40, ovenTempC: 180 },
    ],
  },
  {
    title: 'Locro criollo',
    servings: 8,
    category: 'Almuerzo',
    tags: ['locro', 'argentina', 'invierno', 'patrio'],
    totalTimeMin: 180,
    nutrition: { calories: 520, protein_g: 32, carbs_g: 55, fat_g: 18 },
    ingredients: [
      { name: 'Maíz blanco pelado', quantity: 300, unit: 'g' },
      { name: 'Porotos', quantity: 200, unit: 'g' },
      { name: 'Mondongo', quantity: 300, unit: 'g' },
      { name: 'Panceta ahumada', quantity: 150, unit: 'g' },
      { name: 'Chorizo', quantity: 300, unit: 'g' },
      { name: 'Carne de cerdo', quantity: 300, unit: 'g' },
      { name: 'Papas', quantity: 2, unit: null },
      { name: 'Zapallo', quantity: 300, unit: 'g' },
      { name: 'Cebolla de verdeo', quantity: 4, unit: null },
      { name: 'Pimentón', quantity: 2, unit: 'tbsp' },
      { name: 'Aceite de oliva', quantity: 50, unit: 'ml' },
    ],
    steps: [
      { text: 'Remojar el maíz y los porotos la noche anterior.', durationMin: 480 },
      { text: 'Hervir maíz y porotos por 1 hora.', durationMin: 60 },
      { text: 'En otra olla, dorar las carnes y el mondongo cortado.' },
      { text: 'Unir todo en la olla grande con el zapallo y las papas.' },
      { text: 'Cocinar a fuego lento 90 minutos hasta espesar.', durationMin: 90 },
      { text: 'Preparar sofrito con cebolla de verdeo y pimentón para servir encima.' },
    ],
    notes: 'Plato tradicional del 25 de Mayo y 9 de Julio.',
  },
  {
    title: 'Ensalada César argentina',
    servings: 2,
    category: 'Almuerzo',
    tags: ['ensalada', 'pollo', 'fresca', 'rápida'],
    totalTimeMin: 20,
    dietaryTags: [],
    nutrition: { calories: 380, protein_g: 35, carbs_g: 15, fat_g: 20 },
    ingredients: [
      { name: 'Lechuga romana', quantity: 1, unit: null },
      { name: 'Pechuga de pollo a la plancha', quantity: 300, unit: 'g' },
      { name: 'Pan lactal', quantity: 2, unit: 'slice', note: 'para crutones' },
      { name: 'Queso parmesano rallado', quantity: 50, unit: 'g' },
      { name: 'Mayonesa', quantity: 3, unit: 'tbsp' },
      { name: 'Jugo de limón', quantity: 1, unit: null },
      { name: 'Mostaza', quantity: 1, unit: 'tsp' },
      { name: 'Ajo', quantity: 1, unit: 'clove' },
      { name: 'Salsa inglesa', quantity: 1, unit: 'tsp' },
    ],
    steps: [
      { text: 'Tostar el pan en cubos con aceite y ajo hasta dorar.', durationMin: 5 },
      { text: 'Mezclar mayonesa, limón, mostaza, ajo y salsa inglesa para el aderezo.' },
      { text: 'Cortar la lechuga, agregar el pollo en tiras y los crutones.' },
      { text: 'Incorporar el aderezo y el parmesano. Servir de inmediato.' },
    ],
  },
  {
    title: 'Alfajores caseros de maicena',
    servings: 20,
    category: 'Postre',
    tags: ['alfajores', 'argentina', 'dulce', 'repostería'],
    totalTimeMin: 60,
    dietaryTags: ['vegetariano'],
    nutrition: { calories: 210, protein_g: 3, carbs_g: 32, fat_g: 8 },
    ingredients: [
      { name: 'Maicena', quantity: 300, unit: 'g' },
      { name: 'Harina', quantity: 150, unit: 'g' },
      { name: 'Manteca', quantity: 150, unit: 'g' },
      { name: 'Azúcar impalpable', quantity: 100, unit: 'g' },
      { name: 'Yemas de huevo', quantity: 3, unit: null },
      { name: 'Esencia de vainilla', quantity: 1, unit: 'tsp' },
      { name: 'Polvo de hornear', quantity: 1, unit: 'tsp' },
      { name: 'Dulce de leche repostero', quantity: 400, unit: 'g' },
      { name: 'Coco rallado', quantity: 100, unit: 'g' },
    ],
    steps: [
      { text: 'Batir manteca con azúcar hasta cremar. Agregar yemas y vainilla.' },
      { text: 'Incorporar maicena, harina y polvo de hornear. Amasar suavemente.' },
      { text: 'Refrigerar la masa 30 minutos.', durationMin: 30 },
      { text: 'Estirar a 5mm, cortar círculos de 5cm.' },
      { text: 'Hornear 10-12 minutos a 170°C. No deben dorarse.', durationMin: 12, ovenTempC: 170 },
      { text: 'Enfriar y rellenar con dulce de leche. Pasar los bordes por coco rallado.' },
    ],
  },
  {
    title: 'Revuelto gramajo',
    servings: 2,
    category: 'Desayuno',
    tags: ['huevos', 'papa', 'rápido', 'clásico'],
    totalTimeMin: 20,
    nutrition: { calories: 420, protein_g: 22, carbs_g: 35, fat_g: 22 },
    ingredients: [
      { name: 'Papas', quantity: 2, unit: null },
      { name: 'Huevos', quantity: 4, unit: null },
      { name: 'Jamón cocido', quantity: 100, unit: 'g' },
      { name: 'Aceite', quantity: 3, unit: 'tbsp' },
      { name: 'Sal y pimienta', quantity: null, unit: null },
      { name: 'Perejil', quantity: null, unit: null },
    ],
    steps: [
      {
        text: 'Cortar las papas en juliana y freír en aceite caliente hasta dorar.',
        durationMin: 10,
      },
      { text: 'Escurrir el exceso de aceite. Agregar el jamón en tiras.' },
      { text: 'Incorporar los huevos batidos y revolver rápido hasta ligar.' },
      { text: 'Condimentar y decorar con perejil picado.' },
    ],
  },
]

async function main() {
  console.log(`🌱 Seeding ${RECIPES.length} demo recipes...`)
  let created = 0
  for (const recipe of RECIPES) {
    try {
      const result = (await post('/v1/recipes', recipe)) as { title: string; id: string }
      console.log(`✅ ${result.title}`)
      created++
    } catch (e) {
      console.error(`❌ ${recipe.title}: ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\n✨ Done: ${created}/${RECIPES.length} recipes created`)
}

main().catch(console.error)
