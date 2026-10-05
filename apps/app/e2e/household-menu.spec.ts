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

// 2026-10-02 review (a CI flake on #242): who is signed in only arrived with
// GET /auth/me, so until it answered your own dishes were disabled like a
// housemate's. The token already says who you are.
test('your own dish opens right away, even while /auth/me is slow', async ({ page }) => {
  const headers = await authHeaders(page)
  const today = localToday()
  const recipe = await createRecipeViaApi(page, { category: 'Cena' })
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date: today, slot: 'Cena', recipeId: recipe.id, servings: 2 },
  })
  await page.route('**/auth/me', async (route) => {
    await new Promise((r) => setTimeout(r, 8000))
    await route.fallback()
  })
  try {
    await page.goto('/menu')
    const chip = page.getByTestId(`menu-entry-${today}-Cena-${recipe.id}`)
    await expect(chip).not.toHaveAttribute('aria-disabled', 'true', { timeout: 4000 })
    await chip.click()
    await expect(page.getByTestId('menu-modal-save')).toBeVisible({ timeout: 4000 })
  } finally {
    await page.unroute('**/auth/me')
    await page.request.delete(`${API_URL}/v1/menu/${today}/Cena/${recipe.id}`, { headers })
    await deleteRecipeViaApi(page, recipe.id)
  }
})

// 2026-10-02 review: removing a member only refreshed "Mi hogar", so their
// recipes stayed on home (and their dishes on the planner) for up to 30s.
test('removing a housemate takes their recipes off home right away', async ({ page }, testInfo) => {
  const headers = await authHeaders(page)
  const mine = (await (
    await page.request.get(`${API_URL}/v1/households/mine`, { headers })
  ).json()) as { id: string; ownerId: string }[]
  let householdId = mine[0]?.id
  if (!householdId) {
    householdId = (
      (await (
        await page.request.post(`${API_URL}/v1/households`, {
          headers,
          data: { name: `E2E Hogar Quitar ${Date.now()}` },
        })
      ).json()) as { id: string }
    ).id
  }
  const email = `quitar-e2e-${testInfo.parallelIndex}-${Date.now()}@example.com`
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
  await page.request.post(`${API_URL}/v1/households/${householdId}/accept`, {
    headers: theirHeaders,
  })
  const title = `E2E Del que se va ${Date.now()}`
  const theirs = (await (
    await page.request.post(`${API_URL}/v1/recipes`, {
      headers: theirHeaders,
      data: {
        title,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
        steps: [{ text: 'Único.' }],
      },
    })
  ).json()) as { id: string }
  try {
    await page.goto('/')
    await expect(page.getByTestId(`recipe-card-${theirs.id}`)).toBeVisible()

    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    page.once('dialog', (d) => void d.accept())
    await page.getByTestId(`household-remove-member-${reg.user.id}`).click()
    await expect(page.getByTestId(`household-remove-member-${reg.user.id}`)).toHaveCount(0)

    await page.goBack()
    await expect(page.getByPlaceholder(/buscar recetas/i)).toBeVisible()
    await expect(page.getByTestId(`recipe-card-${theirs.id}`)).toHaveCount(0)
  } finally {
    await page.request.delete(`${API_URL}/v1/recipes/${theirs.id}`, { headers: theirHeaders })
    await page.request.delete(`${API_URL}/v1/households/${householdId}/members/${reg.user.id}`, {
      headers,
    })
  }
})

// Story (Auditar 2026-10-03): one parent records the kid's allergy once in Mi
// hogar; the other parent, who never set it, sees the warning on a recipe.
test("a kid's allergy and diet set by one parent warn the other", async ({ page }, testInfo) => {
  const headers = await authHeaders(page)
  const myToken = headers.Authorization.replace('Bearer ', '')
  const mine = (await (
    await page.request.get(`${API_URL}/v1/households/mine`, { headers })
  ).json()) as { id: string }[]
  let householdId = mine[0]?.id
  if (!householdId) {
    const hh = await page.request.post(`${API_URL}/v1/households`, {
      headers,
      data: { name: `E2E Hogar Comensales ${Date.now()}` },
    })
    householdId = ((await hh.json()) as { id: string }).id
  }

  const email = `pareja-e2e-${testInfo.parallelIndex}-${Date.now()}@example.com`
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
  await page.request.post(`${API_URL}/v1/households/${householdId}/accept`, {
    headers: theirHeaders,
  })

  const kid = `Sofi ${Date.now()}`
  page.on('dialog', (d) => void d.accept())
  await page.goto('/household')
  await page.getByTestId(`household-diner-add-${householdId}`).click()
  await page.getByTestId('household-diner-name').fill(kid)
  await page.getByTestId('household-diner-allergen-mani').click()
  await page.getByTestId('household-diner-save').click()
  const row = page.getByText(kid)
  await expect(row).toBeVisible()
  const diners = (
    (await (await page.request.get(`${API_URL}/v1/households/mine`, { headers })).json()) as {
      id: string
      diners: { id: string; name: string }[]
    }[]
  ).find((h) => h.id === householdId)!.diners
  const dinerId = diners.find((d) => d.name === kid)!.id

  // Edit: the kid is vegan too (and an edit can be cancelled)
  await page.getByTestId(`household-diner-edit-${dinerId}`).click()
  await page.getByTestId('household-diner-cancel').click()
  await page.getByTestId(`household-diner-edit-${dinerId}`).click()
  await page.getByTestId('household-diner-diet-vegano').click()
  await page.getByTestId('household-diner-save').click()
  await expect(page.getByTestId(`household-diner-${dinerId}`)).toContainText('Vegano')

  // A failed save says so
  await page.route(`**/v1/households/${householdId}/diners`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  )
  await page.getByTestId(`household-diner-add-${householdId}`).click()
  await page.getByTestId('household-diner-name').fill('Otro')
  const failed = page.waitForEvent('dialog')
  await page.getByTestId('household-diner-save').click()
  expect((await failed).message()).toContain('No se pudo guardar')
  await page.unroute(`**/v1/households/${householdId}/diners`)
  await page.getByTestId('household-diner-cancel').click()

  const recipe = (await (
    await page.request.post(`${API_URL}/v1/recipes`, {
      headers: theirHeaders,
      data: {
        title: `E2E Alfajor de maní ${Date.now()}`,
        servings: 2,
        category: 'Postre',
        ingredients: [
          { name: 'maní', quantity: 100, unit: 'g' },
          { name: 'manteca', quantity: 50, unit: 'g' },
        ],
        steps: [{ text: 'Mezclar.' }],
      },
    })
  ).json()) as { id: string }

  try {
    // Now as the other parent, who set nothing themselves
    await page.evaluate((jwt) => localStorage.setItem('auth_token', jwt), reg.token)
    await page.goto(`/recipe/${recipe.id}`)
    const warning = page.getByTestId('allergen-warning')
    await expect(warning).toContainText(`Maní (${kid})`)
    await expect(warning).toContainText(`Vegano (${kid})`)

    // Back as the first parent: removing the kid asks first
    await page.evaluate((jwt) => localStorage.setItem('auth_token', jwt), myToken)
    await page.goto('/household')
    await page.getByTestId(`household-diner-remove-${dinerId}`).click()
    await expect(page.getByTestId(`household-diner-${dinerId}`)).toHaveCount(0)
  } finally {
    await page.request.delete(`${API_URL}/v1/households/${householdId}/diners/${dinerId}`, {
      headers,
    })
    await page.request.delete(`${API_URL}/v1/recipes/${recipe.id}`, { headers: theirHeaders })
  }
})
