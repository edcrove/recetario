import { test, expect } from './fixtures'
import { API_URL } from './env'
import { authHeaders, createRecipeViaApi, deleteRecipeViaApi } from './api'

// Configurator bug (2026-10-01 test-base review): each taxonomy tab can create
// a new item, and tapping an item's "N recetas" badge lists the recipes behind
// it, each one opening the recipe.

test('creates a food type, rejects a duplicate, and its badge opens the recipes that use it', async ({
  page,
}) => {
  const name = `Zz e2e ${Math.random().toString(36).slice(2, 8)}`
  let recipeId: string | undefined
  try {
    await page.goto('/config')
    await page.getByTestId('config-tab-food-types').click()
    const input = page.getByTestId('config-new-name')
    await expect(input).toHaveAttribute('placeholder', 'Nuevo tipo de comida')

    // The add button looks disabled until something is typed
    const add = page.getByTestId('config-new-add')
    const opacity = () => add.evaluate((el) => getComputedStyle(el).opacity)
    await expect(add).toBeDisabled()
    expect(await opacity()).toBe('0.4')
    await input.fill(name)
    await expect(add).toBeEnabled()
    expect(await opacity()).toBe('1')
    await add.click()
    await expect(input).toHaveValue('')

    const row = page.locator('[data-testid^="config-item-"]', { hasText: name })
    await expect(row).toBeVisible()
    const foodTypeId = (await row.getAttribute('data-testid'))!.replace('config-item-', '')
    const badge = page.getByTestId(`config-usage-${foodTypeId}`)
    await expect(badge).toHaveText('0 recetas')
    await expect(badge).toBeDisabled()
    const bg = () =>
      badge
        .locator('div')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor)
    const emptyBg = await bg()

    // Same name again → "Ya existe", and the typed name stays
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void d.accept()
    })
    await input.fill(name)
    await add.click()
    await expect.poll(() => dialogs).toEqual([`Ya existe\n\n"${name}" ya está en la lista.`])
    await expect(input).toHaveValue(name)

    // A recipe of that food type → the badge counts it and lists it
    const recipe = await createRecipeViaApi(page, { foodTypeIds: [foodTypeId] })
    recipeId = recipe.id
    await page.reload()
    await page.getByTestId('config-tab-food-types').click()
    await expect(badge).toHaveText('1 receta')
    expect(await bg()).not.toBe(emptyBg)

    await badge.click()
    await expect(page.getByText(`Recetas con "${name}"`)).toBeVisible()
    await page.getByTestId(`config-usage-recipe-${recipe.id}`).click()
    await expect(page).toHaveURL(new RegExp(`/recipe/${recipe.id}$`))
    await expect(page.getByText(recipe.title).first()).toBeVisible()
  } finally {
    if (recipeId) await deleteRecipeViaApi(page, recipeId)
    const headers = await authHeaders(page)
    const overview = (await (
      await page.request.get(`${API_URL}/v1/config/taxonomy`, { headers })
    ).json()) as { foodTypes: { id: string; name: string }[] }
    const ft = overview.foodTypes.find((t) => t.name === name)
    if (ft) await page.request.delete(`${API_URL}/v1/config/food-types/${ft.id}`, { headers })
  }
})

test('creates a tag from its tab; a category badge lists my recipes and closes with Cerrar', async ({
  page,
}) => {
  // Sorts first in the (virtualized) tags list, see below
  const name = `0-e2e-${Math.random().toString(36).slice(2, 8)}`
  let recipeId: string | undefined
  try {
    const recipe = await createRecipeViaApi(page, { category: 'Postre' })
    recipeId = recipe.id
    await page.goto('/config')

    // Categories (default tab): the system "Postre" badge lists the recipe
    await expect(page.getByTestId('config-new-name')).toHaveAttribute(
      'placeholder',
      'Nueva categoría',
    )
    const postre = page.locator('[data-testid^="config-item-"]', { hasText: /^Postre/ })
    await postre.locator('[data-testid^="config-usage-"]').click()
    await expect(page.getByText('Recetas con "Postre"')).toBeVisible()
    await expect(page.getByTestId(`config-usage-recipe-${recipe.id}`)).toHaveText(recipe.title)
    await page.getByTestId('config-usage-close').click()
    await expect(page.getByText('Recetas con "Postre"')).toBeHidden()
    await expect(page).toHaveURL(/\/config$/)

    // Tags: create one
    await page.getByTestId('config-tab-tags').click()
    await expect(page.getByTestId('config-new-name')).toHaveAttribute(
      'placeholder',
      'Nueva etiqueta',
    )
    await page.getByTestId('config-new-name').fill(name)
    await page.getByTestId('config-new-add').click()
    const row = page.locator('[data-testid^="config-item-"]', { hasText: name })
    await expect(row.locator('[data-testid^="config-usage-"]')).toHaveText('0 recetas')
  } finally {
    if (recipeId) await deleteRecipeViaApi(page, recipeId)
    const headers = await authHeaders(page)
    const overview = (await (
      await page.request.get(`${API_URL}/v1/config/taxonomy`, { headers })
    ).json()) as { tags: { id: string; name: string }[] }
    const tag = overview.tags.find((t) => t.name === name)
    if (tag) await page.request.delete(`${API_URL}/v1/config/tags/${tag.id}`, { headers })
  }
})

// Latent bug (D-2026-10-02-1): a recipe's tags never reached the tag registry,
// so tag badges stayed at 0 and renaming a tag never touched the recipes.
test("a recipe's tag shows in the tags tab, and renaming it renames it on the recipe", async ({
  page,
}) => {
  // Starts with a digit so it sorts first: the tags list is virtualized and the
  // demo account has dozens of tags, so a name sorting last may not be rendered
  const tag = `0tag${Math.random().toString(36).slice(2, 8)}`
  const renamed = `${tag}-nuevo`
  const recipe = await createRecipeViaApi(page, { tags: [tag] })
  const headers = await authHeaders(page)
  try {
    await page.goto('/config')
    await page.getByTestId('config-tab-tags').click()
    const row = page.locator('[data-testid^="config-item-"]', { hasText: tag })
    const badge = row.locator('[data-testid^="config-usage-"]')
    await expect(badge).toHaveText('1 receta')
    await badge.click()
    await expect(page.getByTestId(`config-usage-recipe-${recipe.id}`)).toHaveText(recipe.title)
    await page.getByTestId('config-usage-close').click()

    await row.locator('[data-testid^="config-edit-"]').click()
    await page.getByPlaceholder('Nuevo nombre').fill(renamed)
    await page.getByTestId('config-rename-save').click()
    await expect(page.locator('[data-testid^="config-item-"]', { hasText: renamed })).toBeVisible()

    const res = await page.request.get(`${API_URL}/v1/recipes/${recipe.id}`, { headers })
    expect(((await res.json()) as { tags: string[] }).tags).toEqual([renamed])
  } finally {
    await deleteRecipeViaApi(page, recipe.id)
    const overview = (await (
      await page.request.get(`${API_URL}/v1/config/taxonomy`, { headers })
    ).json()) as { tags: { id: string; slug: string }[] }
    for (const t of overview.tags.filter((t) => t.slug.startsWith(tag))) {
      await page.request.delete(`${API_URL}/v1/config/tags/${t.id}`, { headers })
    }
  }
})

// Latent bug (D-2026-10-02-2): recipes only took the 7 built-in categories, so a
// category created in the configurator could never be used.
test('a category created in the configurator can be picked for a new recipe', async ({ page }) => {
  const category = `Zz cat ${Math.random().toString(36).slice(2, 8)}`
  const title = `E2E categoría ${Date.now()}`
  const headers = await authHeaders(page)
  let recipeId: string | undefined
  try {
    await page.goto('/config')
    await page.getByTestId('config-new-name').fill(category)
    await page.getByTestId('config-new-add').click()
    await expect(page.locator('[data-testid^="config-item-"]', { hasText: category })).toBeVisible()

    await page.goto('/recipe/new')
    const chip = page.getByTestId(`recipe-category-${category}`)
    const cena = page.getByTestId('recipe-category-Cena')
    const bg = (l: typeof chip) => l.evaluate((el) => getComputedStyle(el).backgroundColor)
    await expect(cena).toHaveAttribute('aria-selected', 'true')
    const selectedBg = await bg(cena)
    expect(await bg(chip)).not.toBe(selectedBg)
    const fg = (l: typeof chip) =>
      l
        .locator('div')
        .first()
        .evaluate((el) => getComputedStyle(el).color)
    const selectedFg = await fg(cena)
    expect(await fg(chip)).not.toBe(selectedFg)
    await chip.click()
    await expect(chip).toHaveAttribute('aria-selected', 'true')
    expect(await bg(chip)).toBe(selectedBg)
    expect(await fg(chip)).toBe(selectedFg)
    expect(await bg(cena)).not.toBe(selectedBg)

    await page.getByPlaceholder('Nombre de la receta').fill(title)
    await page.getByPlaceholder('Ingrediente').first().fill('Pan')
    await page.getByText('Guardar Receta').click()
    await expect(page.getByTestId('recipe-saved-banner')).toBeVisible()
    recipeId = page.url().split('/recipe/')[1]?.split(/[?#]/)[0]
    await expect(page.getByText(category).first()).toBeVisible()

    const res = await page.request.get(`${API_URL}/v1/recipes/${recipeId}`, { headers })
    expect(((await res.json()) as { category: string }).category).toBe(category)
  } finally {
    if (recipeId) await deleteRecipeViaApi(page, recipeId)
    const overview = (await (
      await page.request.get(`${API_URL}/v1/config/taxonomy`, { headers })
    ).json()) as { mealCategories: { id: string; name: string }[] }
    const created = overview.mealCategories.find((c) => c.name === category)
    if (created) {
      await page.request.delete(`${API_URL}/v1/config/categories/${created.id}`, { headers })
    }
  }
})
