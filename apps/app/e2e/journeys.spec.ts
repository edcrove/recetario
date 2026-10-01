import { test, expect } from './fixtures'
import type { APIRequestContext, Page } from '@playwright/test'
import { API_URL } from './env'

// End-to-end user journeys (test-base review, 2026-10-01). The rest of the
// suite checks screens one at a time; these walk a goal from start to finish
// the way a person does it, on a phone-sized viewport, and assert the outcome
// they care about (what to buy, who sees what) rather than that a screen opened.

const PHONE = { width: 390, height: 844 }

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const json = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

async function register(request: APIRequestContext, label: string) {
  const email = `journey-${label}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { email, password: 'journey1234', displayName: `Journey ${label}` },
  })
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as { token: string; user: { id: string } }
  return { email, token: body.token, id: body.user.id }
}

async function signInAs(page: Page, token: string) {
  await page.evaluate((jwt) => localStorage.setItem('auth_token', jwt), token)
  await page.goto('/')
  await expect(page.getByTestId('home-profile-button')).toBeVisible()
}

test.describe('Journey: the organizer plans the week on a phone', () => {
  test('plan two dishes → the shopping list sums the shared ingredient → tick it → mark one cooked', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    const token = (await page.evaluate(() => localStorage.getItem('auth_token')))!
    const headers = json(token)
    const stamp = Date.now()
    const ingredient = `quinotos ${stamp}`
    const today = localIso(new Date())
    const created: string[] = []
    const make = async (title: string) => {
      const res = await page.request.post(`${API_URL}/v1/recipes`, {
        headers,
        data: {
          title,
          servings: 2,
          category: 'Cena',
          ingredients: [{ name: ingredient, quantity: 1, unit: 'unit' }],
          steps: [{ text: 'Cocinar.' }],
        },
      })
      expect(res.ok()).toBe(true)
      const r = (await res.json()) as { id: string }
      created.push(r.id)
      return r.id
    }
    const first = await make(`Journey Guiso ${stamp}`)
    const second = await make(`Journey Tarta ${stamp}`)
    // The second dish is already on the menu (planned earlier in the week).
    await page.request.post(`${API_URL}/v1/menu`, {
      headers,
      data: { date: today, slot: 'Almuerzo', recipeId: second, servings: 2 },
    })

    try {
      // Plan the first dish for tonight from the planner, as a person would.
      await page.getByText('Menú Semanal').click()
      await page.getByTestId(`menu-add-${today}-Merienda`).click()
      await page.getByPlaceholder('Buscar receta...').fill(`Journey Guiso ${stamp}`)
      await page.getByTestId(`pick-recipe-${first}`).click()
      await expect(page.getByTestId(`menu-entry-${today}-Merienda-${first}`)).toBeVisible()

      // The shopping list adds the onion-like item across both dishes: 2, not two lines of 1.
      await page.getByText('Lista de compras').first().click()
      const row = page.locator('[data-testid^="shopping-item-"]').filter({ hasText: ingredient })
      await expect(row).toHaveCount(1)
      await expect(row).toContainText('2 u')
      const before = await page.getByTestId('shopping-progress').textContent()
      await row.click()
      await expect(page.getByTestId('shopping-progress')).not.toHaveText(before!)
      await row.click() // leave the list as found

      // Back on the planner, the dish is marked cooked.
      await page.goto('/menu')
      await page.getByTestId(`menu-entry-${today}-Merienda-${first}`).click()
      await page.getByTestId('menu-modal-status-cooked').click()
      await expect(page.getByTestId(`menu-entry-${today}-Merienda-${first}`)).toContainText('✓')
    } finally {
      await page.request.delete(`${API_URL}/v1/menu/${today}/Merienda/${first}`, { headers })
      await page.request.delete(`${API_URL}/v1/menu/${today}/Almuerzo/${second}`, { headers })
      for (const id of created)
        await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
    }
  })
})

test.describe('Journey: two people share a household', () => {
  test('owner invites by email → member accepts in Mi hogar → sees the recipe → plans it → owner sees the plan', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    const owner = await register(page.request, 'owner')
    const member = await register(page.request, 'member')
    const today = localIso(new Date())
    const title = `Journey Locro compartido ${Date.now()}`

    const hh = await page.request.post(`${API_URL}/v1/households`, {
      headers: json(owner.token),
      data: { name: 'Familia Journey' },
    })
    expect(hh.ok()).toBe(true)
    const householdId = ((await hh.json()) as { id: string }).id
    const rec = await page.request.post(`${API_URL}/v1/recipes`, {
      headers: json(owner.token),
      data: {
        title,
        servings: 4,
        category: 'Cena',
        ingredients: [{ name: 'zapallo', quantity: 1, unit: 'kg' }],
        steps: [{ text: 'Hervir.' }],
      },
    })
    const recipeId = ((await rec.json()) as { id: string }).id
    const invite = await page.request.post(`${API_URL}/v1/households/${householdId}/invite`, {
      headers: json(owner.token),
      data: { email: member.email, role: 'member' },
    })
    expect(invite.status()).toBe(201)

    try {
      // Before accepting, the member sees nothing of the owner's.
      await signInAs(page, member.token)
      await expect(page.getByTestId(`recipe-card-${recipeId}`)).toHaveCount(0)

      // The member accepts from the home banner → Mi hogar.
      await page.getByTestId('home-invitation-banner').click()
      await page.getByTestId(`household-accept-${householdId}`).click()
      await expect(page.getByTestId(`household-accept-${householdId}`)).toHaveCount(0)

      // Now the shared recipe is on the member's home and can be planned.
      await page.goto('/')
      await page.getByPlaceholder(/buscar recetas/i).fill(title)
      await expect(page.getByTestId(`recipe-card-${recipeId}`)).toBeVisible()
      await page.goto('/menu')
      await page.getByTestId(`menu-add-${today}-Cena`).click()
      await page.getByPlaceholder('Buscar receta...').fill(title)
      await page.getByTestId(`pick-recipe-${recipeId}`).click()
      await expect(page.getByTestId(`menu-entry-${today}-Cena-${recipeId}`)).toBeVisible()

      // The owner opens the planner on their own session and finds it there.
      await signInAs(page, owner.token)
      await page.goto('/menu')
      await expect(page.getByTestId(`menu-entry-${today}-Cena-${recipeId}`)).toBeVisible()
    } finally {
      await page.request.delete(`${API_URL}/v1/menu/${today}/Cena/${recipeId}`, {
        headers: json(member.token),
      })
      await page.request.delete(`${API_URL}/v1/recipes/${recipeId}`, { headers: json(owner.token) })
    }
  })
})
