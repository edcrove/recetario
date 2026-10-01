import { test, expect } from './fixtures'
import type { APIRequestContext } from '@playwright/test'
import { API_URL } from './env'

// Shopping list v2 (story 2): items group by aisle, check-off is optimistic and
// persists server-side. Seeds a recipe + menu entry per week via the API.

async function seedWeek(request: APIRequestContext, headers: Record<string, string>, week: string) {
  const recipeRes = await request.post(`${API_URL}/v1/recipes`, {
    headers,
    data: {
      title: `E2E Compras ${Date.now()}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'harina', quantity: 500, unit: 'g' }],
      steps: [{ text: 'Mezclar.' }],
    },
  })
  expect(recipeRes.ok()).toBe(true)
  const recipe = (await recipeRes.json()) as { id: string }
  const menuRes = await request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date: week, slot: 'Cena', recipeId: recipe.id, servings: 2 },
  })
  expect(menuRes.ok()).toBe(true)
  // Normalize starting state (a prior local run may have left a check behind).
  await request.put(`${API_URL}/v1/menu/shopping-list/check`, {
    headers,
    data: { weekStart: week, key: 'harina', checked: false },
  })
  return recipe.id
}

async function cleanup(
  request: APIRequestContext,
  headers: Record<string, string>,
  week: string,
  recipeId: string,
) {
  await request.put(`${API_URL}/v1/menu/shopping-list/check`, {
    headers,
    data: { weekStart: week, key: 'harina', checked: false },
  })
  await request.delete(`${API_URL}/v1/menu/${week}/Cena`, { headers })
  await request.delete(`${API_URL}/v1/recipes/${recipeId}`, { headers })
}

test('checking a shopping-list item persists across a reload', async ({ page }) => {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const week = '2027-03-01' // a Monday clear of other specs' weeks
  const recipeId = await seedWeek(page.request, headers, week)

  try {
    await page.goto(`/menu/shopping-list?weekStart=${week}`)
    const row = page.getByTestId('shopping-item-harina')
    await expect(row).toBeVisible()
    await expect(page.getByTestId('shopping-progress')).toHaveText('0 / 1')

    await row.click()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 1')

    // Reload — the check came from the server, so it must still be there.
    await page.reload()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 1')
    await expect(page.getByTestId('shopping-item-harina').getByText('✓')).toBeVisible()
  } finally {
    await cleanup(page.request, headers, week, recipeId)
  }
})

test('optimistic tick is applied on click and rolled back when the request fails', async ({
  page,
}) => {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const week = '2027-03-08' // distinct week so it can't collide with the reload test
  const recipeId = await seedWeek(page.request, headers, week)

  try {
    await page.goto(`/menu/shopping-list?weekStart=${week}`)
    const row = page.getByTestId('shopping-item-harina')
    await expect(row).toBeVisible()

    // Successful check: optimistic tick sticks (no reload, so this coverage is kept).
    await row.click()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 1')
    await expect(row.getByText('✓')).toBeVisible()

    // Failing uncheck: intercept the PUT so it errors; the optimistic flip to
    // 0/1 must roll back to 1/1.
    await page.route('**/menu/shopping-list/check', (r) => r.abort())
    await row.click()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 1')
    await page.unroute('**/menu/shopping-list/check')
  } finally {
    await cleanup(page.request, headers, week, recipeId)
  }
})

// Story "Expo: shopping list UI": "Copy-to-clipboard button (plain text
// format)" and "Refresh button to regenerate from current menu". Reads the
// real browser clipboard, and changes the menu behind the open screen.
test('copies the pending list as plain text, and Actualizar picks up a menu change', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const week = '2027-03-22' // a Monday clear of other specs' weeks
  const recipeId = await seedWeek(page.request, headers, week)
  let extraId: string | null = null
  try {
    await page.goto(`/menu/shopping-list?weekStart=${week}`)
    await expect(page.getByTestId('shopping-item-harina')).toBeVisible()

    await page.getByTestId('shopping-copy').click()
    await expect(page.getByTestId('shopping-copy')).toHaveText('✓ Copiada')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied.split('\n')[0]).toMatch(/^Lista de compras · semana del /)
    expect(copied).toMatch(/^- harina: 500 g$/im)

    // Plan another dish while the list is open: Actualizar brings it in.
    const extra = await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title: `E2E Compras extra ${Date.now()}`,
        servings: 2,
        category: 'Cena',
        ingredients: [{ name: 'azafrán', quantity: 1, unit: 'g' }],
        steps: [{ text: 'Usar.' }],
      },
    })
    extraId = ((await extra.json()) as { id: string }).id
    await page.request.post(`${API_URL}/v1/menu`, {
      headers,
      data: { date: '2027-03-23', slot: 'Cena', recipeId: extraId, servings: 2 },
    })
    await expect(page.getByText(/azafrán/i)).toHaveCount(0)
    await page.getByTestId('shopping-refresh').click()
    await expect(page.getByText(/azafrán/i)).toBeVisible()

    // Ticked items drop out of the copied text.
    await page.getByTestId('shopping-item-harina').click()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 2')
    await page.getByTestId('shopping-copy').click()
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .not.toMatch(/harina/i)
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^- azafrán: 1 g$/im)
  } finally {
    if (extraId) {
      await page.request.delete(`${API_URL}/v1/menu/2027-03-23/Cena`, { headers })
      await page.request.delete(`${API_URL}/v1/recipes/${extraId}`, { headers })
    }
    await cleanup(page.request, headers, week, recipeId)
  }
})

// A browser that refuses the clipboard must say so, not claim "✓ Copiada".
test('when the browser refuses the clipboard the user is told, not shown "Copiada"', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
    })
    document.execCommand = () => {
      throw new Error('blocked')
    }
  })
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const week = '2027-03-29'
  const recipeId = await seedWeek(page.request, headers, week)
  try {
    await page.goto(`/menu/shopping-list?weekStart=${week}`)
    await expect(page.getByTestId('shopping-item-harina')).toBeVisible()
    // window.alert blocks the click until handled: record and accept it
    const messages: string[] = []
    page.on('dialog', (d) => {
      messages.push(d.message())
      void d.accept()
    })
    await page.getByTestId('shopping-copy').click()
    await expect.poll(() => messages.join('|')).toContain('No se pudo copiar')
    await expect(page.getByTestId('shopping-copy')).toHaveText('📋 Copiar lista')

    // With everything ticked off there is nothing to copy, and it says so.
    await page.getByTestId('shopping-item-harina').click()
    await expect(page.getByTestId('shopping-progress')).toHaveText('1 / 1')
    await page.getByTestId('shopping-copy').click()
    await expect.poll(() => messages.join('|')).toContain('No queda nada por comprar')
  } finally {
    await cleanup(page.request, headers, week, recipeId)
  }
})

test('an empty week disables copying and greys the label out', async ({ page }) => {
  await page.goto('/menu/shopping-list?weekStart=2027-04-05') // nothing planned
  await expect(page.getByText('No hay ingredientes para esta semana')).toBeVisible()
  await expect(page.getByTestId('shopping-copy')).toBeDisabled()
  const colour = (id: string) =>
    page.getByTestId(id).evaluate((el) => getComputedStyle(el.querySelector('div') ?? el).color)
  expect(await colour('shopping-copy')).not.toBe(await colour('shopping-refresh'))
})
