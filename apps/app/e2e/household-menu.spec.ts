import { test, expect } from './fixtures'
import { API_URL } from './env'
import { authHeaders, createRecipeViaApi, deleteRecipeViaApi } from './api'

function localToday(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// Bug (2026-10-02 review): the week shows every housemate's dishes, but the API
// only takes changes to your own, so a housemate's dish offered edit/✕ buttons
// that always failed ("No se pudo quitar…"). Their dishes are now read-only.
test("a housemate's planned dish shows read-only; mine stays editable and asks before removing", async ({
  page,
}, testInfo) => {
  const headers = await authHeaders(page)
  const today = localToday()
  const mine = (await (
    await page.request.get(`${API_URL}/v1/households/mine`, { headers })
  ).json()) as { id: string }[]
  let householdId = mine[0]?.id
  if (!householdId) {
    const hh = await page.request.post(`${API_URL}/v1/households`, {
      headers,
      data: { name: `E2E Hogar Menú ${Date.now()}` },
    })
    householdId = ((await hh.json()) as { id: string }).id
  }

  // A housemate (member, not viewer) who accepted the invitation
  const email = `housemate-e2e-${testInfo.parallelIndex}-${Date.now()}@example.com`
  const reg = (await (
    await page.request.post(`${API_URL}/auth/register`, {
      data: { email, password: 'password123' },
    })
  ).json()) as { token: string; user: { id: string } }
  const theirHeaders = { Authorization: `Bearer ${reg.token}`, 'Content-Type': 'application/json' }
  await page.request.post(`${API_URL}/v1/households/${householdId}/invite`, {
    headers,
    data: { userId: reg.user.id, role: 'member' },
  })
  expect(
    (
      await page.request.post(`${API_URL}/v1/households/${householdId}/accept`, {
        headers: theirHeaders,
      })
    ).status(),
  ).toBe(200)

  const recipe = await createRecipeViaApi(page, { category: 'Cena' })
  const theirRecipe = (await (
    await page.request.post(`${API_URL}/v1/recipes`, {
      headers: theirHeaders,
      data: {
        title: `E2E Plato del otro ${Date.now()}`,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
        steps: [{ text: 'Único.' }],
      },
    })
  ).json()) as { id: string; title: string }
  await page.request.post(`${API_URL}/v1/menu`, {
    headers: theirHeaders,
    data: { date: today, slot: 'Cena', recipeId: theirRecipe.id, servings: 2 },
  })
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date: today, slot: 'Cena', recipeId: recipe.id, servings: 2 },
  })

  try {
    await page.goto('/menu')
    const theirs = page.getByTestId(`menu-entry-${today}-Cena-${theirRecipe.id}`)
    await expect(theirs).toContainText(theirRecipe.title)
    await expect(theirs).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId(`menu-remove-${today}-Cena-${theirRecipe.id}`)).toHaveCount(0)

    // Mine: the modal's "Eliminar del menú" asks first; declining keeps the dish
    const dialogs: string[] = []
    let accept = false
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void (accept ? d.accept() : d.dismiss())
    })
    const own = page.getByTestId(`menu-entry-${today}-Cena-${recipe.id}`)
    await own.click()
    await page.getByTestId('menu-modal-delete').click()
    await expect.poll(() => dialogs.length).toBe(1)
    expect(dialogs[0]).toContain(`¿Quitar "${recipe.title}" de cena?`)
    await expect(page.getByTestId('menu-modal-delete')).toBeVisible()
    accept = true
    await page.getByTestId('menu-modal-delete').click()
    await expect(own).toHaveCount(0)
    await expect(theirs).toBeVisible()
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${today}/Cena/${recipe.id}`, { headers })
    await page.request.delete(`${API_URL}/v1/menu/${today}/Cena/${theirRecipe.id}`, {
      headers: theirHeaders,
    })
    await page.request.delete(`${API_URL}/v1/recipes/${theirRecipe.id}`, { headers: theirHeaders })
    await deleteRecipeViaApi(page, recipe.id)
    await page.request.delete(`${API_URL}/v1/households/${householdId}/members/${reg.user.id}`, {
      headers,
    })
  }
})
