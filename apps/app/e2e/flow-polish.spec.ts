import { test, expect } from './fixtures'
import { authHeaders, createRecipeViaApi, deleteRecipeViaApi } from './api'
import { API_URL } from './env'

// Found reviewing the E2E screenshots (2026-10-02): layout and flow slips that
// jsdom can't see, so they are checked in the real browser here.

function localToday(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

test('the pick screen filter chips are shown whole, not cut in half', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`/menu/pick?date=${localToday()}&slot=Desayuno`)
  const chip = page.getByTestId('pick-filter-time-20')
  await expect(chip).toBeVisible()
  // Clipping by the row's container doesn't change the chip's own box, so check
  // what is actually painted at the chip's bottom edge: the chip, not the list.
  const bottomIsChip = await chip.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 3)
    return !!hit && el.contains(hit)
  })
  expect(bottomIsChip).toBe(true)
})

test("the planner marks today, and the day's summary sits inside the card with kcal units", async ({
  page,
}) => {
  const headers = await authHeaders(page)
  const today = localToday()
  // A 2000 kcal goal, so one 500 kcal dish leaves "faltan 1500 kcal" (other tests
  // on this account change the goal)
  await page.request.patch(`${API_URL}/auth/profile`, {
    headers,
    data: {
      nutritionTargets: {
        daily_calories: 2000,
        daily_protein_g: 100,
        daily_carbs_g: 250,
        daily_fat_g: 70,
      },
    },
  })
  const recipe = await createRecipeViaApi(page, {
    category: 'Almuerzo',
    nutrition: { calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15 },
  })
  await page.request.post(`${API_URL}/v1/menu`, {
    headers,
    data: { date: today, slot: 'Almuerzo', recipeId: recipe.id, servings: 2 },
  })
  try {
    await page.goto('/menu')
    const card = page.getByTestId(`menu-day-${today}`)
    await expect(card).toHaveAttribute('aria-current', 'date')
    await expect(card).toContainText('Hoy · ')
    await expect(page.locator('[aria-current="date"]')).toHaveCount(1)
    // Today's card (and only it) gets the thicker accent border, and its title
    // takes the same accent colour
    const style = (sel: string) =>
      page.getByTestId(sel).evaluate((el) => {
        const card = getComputedStyle(el)
        const title = getComputedStyle(el.firstElementChild as Element)
        return { width: card.borderTopWidth, border: card.borderTopColor, title: title.color }
      })
    const others = await page
      .locator('[data-testid^="menu-day-"]')
      .evaluateAll((els) =>
        els
          .filter((el) => !el.hasAttribute('aria-current'))
          .map((el) => el.getAttribute('data-testid')!),
      )
    const mine = await style(`menu-day-${today}`)
    const other = await style(others[0]!)
    expect(mine.width).toBe('2px')
    expect(other.width).toBe('1px')
    expect(mine.title).toBe(mine.border)
    expect(other.title).not.toBe(mine.border)

    const summary = page.getByTestId(`day-nutrition-${today}`)
    await expect(summary).toBeVisible({ timeout: 12000 })
    await expect(summary.getByText('faltan 1500 kcal', { exact: true })).toBeVisible()
    const text = summary.getByText(/Por persona:/)
    const inset = (await text.boundingBox())!.x - (await card.boundingBox())!.x
    expect(inset).toBeGreaterThanOrEqual(8)
  } finally {
    await page.request.delete(`${API_URL}/v1/menu/${today}/Almuerzo/${recipe.id}`, { headers })
    await deleteRecipeViaApi(page, recipe.id)
  }
})

test('the history tab of a recipe has no servings stepper', async ({ page }) => {
  const recipe = await createRecipeViaApi(page)
  try {
    await page.goto(`/recipe/${recipe.id}`)
    await expect(page.getByTestId('servings-plus')).toBeVisible()
    await page.getByTestId('recipe-tab-history').click()
    await expect(page.getByText('Todavía no cocinaste esta receta.')).toBeVisible()
    await expect(page.getByTestId('servings-plus')).toBeHidden()
  } finally {
    await deleteRecipeViaApi(page, recipe.id)
  }
})

test('the profile diet chips read as words', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByTestId('profile-diet-chip-sin-gluten')).toHaveText('Sin gluten')
  await expect(page.getByTestId('profile-diet-chip-sin-lactosa')).toHaveText('Sin lactosa')
})

// 2026-10-02 review: "Te puede gustar" listed related recipes by a raw id prefix
// ("4f14540b…") instead of their title.
test('"Te puede gustar" names the related recipe and opens it', async ({ page }) => {
  const headers = await authHeaders(page)
  const from = await createRecipeViaApi(page)
  const to = await createRecipeViaApi(page, { title: `E2E Relacionada ${Date.now()}` })
  try {
    const rel = await page.request.post(`${API_URL}/v1/recipes/${from.id}/relations`, {
      headers,
      data: { toId: to.id, relationType: 'variation' },
    })
    expect(rel.status()).toBe(201)
    await page.goto(`/recipe/${from.id}`)
    const row = page.getByTestId(`recipe-related-${to.id}`)
    await expect(row).toContainText('Variación')
    await expect(row).toContainText(to.title)
    await expect(row).not.toContainText(to.id.slice(0, 8))
    await row.click()
    await expect(page).toHaveURL(new RegExp(`/recipe/${to.id}$`))
  } finally {
    await deleteRecipeViaApi(page, from.id)
    await deleteRecipeViaApi(page, to.id)
  }
})
