import { test, expect } from './fixtures'

// ¿Qué hay en la heladera? story 3: type/pick what you have → "Podés cocinar ya"
// and "Te falta poco"; the "Tu semana" tab lists the planned week's gap and
// jumps to the shopping list.
const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'

function weekStartUTC(): string {
  const d = new Date()
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}
function addDaysUTC(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

test('pick/type ingredients → cook now + almost, and the weekly gap jumps to the list', async ({
  page,
}) => {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const p = `zz${Math.random().toString(36).slice(2, 7)}`
  const rice = `${p}arroz`
  const chicken = `${p}pollo`
  const week = weekStartUTC()
  const today = new Date().toISOString().slice(0, 10)
  // A planned day that isn't today, so today's remaining goal is the full target.
  const mealDate = week === today ? addDaysUTC(week, 1) : week
  const created: string[] = []
  let pantryId = ''

  try {
    // A daily calorie goal so the goalFit badge can light up.
    await page.request.patch(`${API_URL}/auth/profile`, {
      headers,
      data: {
        nutritionTargets: {
          daily_calories: 600,
          daily_protein_g: 40,
          daily_carbs_g: 20,
          daily_fat_g: 15,
        },
      },
    })
    // Rice in the pantry → offered as a quick-add chip.
    pantryId = (
      (await (
        await page.request.post(`${API_URL}/v1/pantry`, {
          headers,
          data: { name: rice, inStock: true },
        })
      ).json()) as { id: string }
    ).id

    const mk = async (title: string, ings: string[], nutrition?: object) =>
      (
        (await (
          await page.request.post(`${API_URL}/v1/recipes`, {
            headers,
            data: {
              title,
              servings: 1,
              category: 'Cena',
              ingredients: ings.map((name) => ({ name, quantity: 1, unit: 'unit' })),
              steps: [{ text: 'Cocinar.' }],
              ...(nutrition ? { nutrition } : {}),
            },
          })
        ).json()) as { id: string }
      ).id

    // Cookable from rice alone, with nutrition close to the 600 kcal goal → "dentro".
    const cookId = await mk(`${p} Arroz listo`, [rice], {
      calories: 520,
      protein_g: 30,
      carbs_g: 60,
      fat_g: 10,
    })
    // Needs chicken too → "Te falta poco".
    const almostId = await mk(`${p} Arroz con pollo`, [rice, chicken])
    created.push(cookId, almostId)
    await page.request.post(`${API_URL}/v1/menu`, {
      headers,
      data: { date: mealDate, slot: 'Cena', recipeId: almostId, servings: 1 },
    })

    // From home into the screen.
    await page.goto('/')
    await page.getByTestId('home-heladera-button').click()
    await expect(page.getByTestId('heladera-input')).toBeVisible({ timeout: 10000 })

    // Pick rice from the pantry chips, and type a second ingredient.
    await page.getByTestId(`heladera-pantry-chip-${pantryId}`).click()
    await expect(page.getByTestId(`heladera-have-${rice}`)).toBeVisible()
    await page.getByTestId('heladera-input').fill(`${p}sal`)
    await page.getByTestId('heladera-add').click()
    await expect(page.getByTestId(`heladera-have-${p}sal`)).toBeVisible()

    // Rice alone → the rice recipe is cookable now, with macro strip + goal badge.
    await expect(page.getByTestId('heladera-cookable')).toBeVisible({ timeout: 10000 })
    const cookCard = page.getByTestId(`heladera-recipe-${cookId}`)
    await expect(cookCard).toBeVisible()
    await expect(cookCard.getByText(/520 kcal/)).toBeVisible()
    await expect(page.getByTestId(`heladera-goalfit-${cookId}`)).toBeVisible()
    // The chicken recipe is "te falta poco".
    await expect(page.getByTestId('heladera-almost')).toBeVisible()
    await expect(page.getByTestId(`heladera-recipe-${almostId}`)).toBeVisible()

    // Remove both picked ingredients → back to the empty prompt.
    await page.getByTestId(`heladera-have-${p}sal`).click()
    await page.getByTestId(`heladera-have-${rice}`).click()
    await expect(page.getByText(/Escribí lo que tenés en casa/)).toBeVisible()

    // Tu semana: the planned meal is incomplete (empty pantry for chicken) → to the list.
    await page.getByTestId('heladera-tab-semana').click()
    await expect(page.getByText('Incompleta').first()).toBeVisible({ timeout: 10000 })
    await page.getByTestId('heladera-add-to-list').click()
    await expect(page).toHaveURL(/shopping-list/, { timeout: 10000 })
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${mealDate}/Cena`, { headers })
    if (pantryId) await page.request.delete(`${API_URL}/v1/pantry/${pantryId}`, { headers })
    for (const id of created) await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
  }
})
