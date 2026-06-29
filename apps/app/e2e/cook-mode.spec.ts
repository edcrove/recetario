import { test, expect, type Page } from '@playwright/test'

async function createRecipeAndGetId(page: Page): Promise<string | null> {
  await page.goto('/')
  await page.getByText(/nueva receta/i).click()
  await expect(page).toHaveURL(/\/recipe\/new/, { timeout: 10000 })

  const titleInput = page.getByPlaceholder(/título/i)
  await expect(titleInput).toBeVisible({ timeout: 15000 })
  await titleInput.fill('Test Cook Mode')

  const categoryInput = page.getByPlaceholder(/categoría/i)
  if (await categoryInput.isVisible()) await categoryInput.fill('Test')

  const addIngredientBtn = page.getByText(/\+ ingrediente/i)
  if (await addIngredientBtn.isVisible()) {
    await addIngredientBtn.click()
    const nameInput = page.getByPlaceholder(/nombre/i).first()
    if (await nameInput.isVisible()) await nameInput.fill('Agua')
  }

  const addStepBtn = page.getByText(/\+ paso/i)
  if (await addStepBtn.isVisible()) {
    await addStepBtn.click()
    const stepInput = page.getByPlaceholder(/descripción del paso/i).first()
    if (await stepInput.isVisible()) await stepInput.fill('Hervir el agua')
  }

  await page
    .getByText(/guardar|crear/i)
    .first()
    .click()
  await page.waitForURL(/\/recipe\/[^/]+$/, { timeout: 10000 }).catch(() => null)

  const match = page.url().match(/\/recipe\/([^/]+)$/)
  return match?.[1] ?? null
}

test.describe('Cook mode screen (/recipe/:id/cook)', () => {
  test('navigates to cook mode from recipe detail', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    const firstRecipe = page.getByText(/porc\. base|\d+ min/i).first()
    const hasRecipes = (await firstRecipe.count()) > 0

    if (!hasRecipes) {
      test.skip()
      return
    }

    await page.locator('a, [role="link"]').first().click()
    await expect(page).toHaveURL(/\/recipe\/[^/]+$/, { timeout: 10000 })

    const cookBtn = page.getByText(/iniciar cocina/i)
    if (await cookBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cookBtn.click()
      await expect(page).toHaveURL(/\/recipe\/[^/]+\/cook/, { timeout: 10000 })
    }
  })

  test('cook mode shows step counter and navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1500)

    const links = page.locator('a[href*="/recipe/"]')
    const count = await links.count()
    if (count === 0) {
      test.skip()
      return
    }

    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href')
      if (!href || href.includes('/new') || href.includes('/edit') || href.includes('/cook'))
        continue

      const id = href.match(/\/recipe\/([^/]+)/)?.[1]
      if (!id) continue

      await page.goto(`/recipe/${id}/cook`)
      await page.waitForTimeout(1000)

      const hasStepper = (await page.getByText(/paso \d+ \//i).count()) > 0
      const isEmpty = (await page.getByText(/no tiene pasos/i).count()) > 0

      if (hasStepper) {
        await expect(page.getByText(/paso \d+ \//i)).toBeVisible()
        await expect(page.getByText('Siguiente')).toBeVisible()
        await expect(page.getByText('Anterior')).toBeVisible()
        return
      }
      if (isEmpty) {
        await expect(page.getByText(/no tiene pasos/i)).toBeVisible()
        return
      }
    }
    test.skip()
  })

  test('cook mode tab bar switches between Pasos and Ingredientes', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1500)

    const links = page.locator('a[href*="/recipe/"]')
    const count = await links.count()
    if (count === 0) {
      test.skip()
      return
    }

    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href')
      if (!href || href.includes('/new') || href.includes('/edit') || href.includes('/cook'))
        continue

      const id = href.match(/\/recipe\/([^/]+)/)?.[1]
      if (!id) continue

      await page.goto(`/recipe/${id}/cook`)
      await page.waitForTimeout(1000)

      const ingredientesTab = page.getByText('Ingredientes').first()
      if (await ingredientesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ingredientesTab.click()
        await expect(page.getByText('Pasos')).toBeVisible()
        return
      }
    }
    test.skip()
  })

  test('close button returns to recipe detail', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1500)

    const links = page.locator('a[href*="/recipe/"]')
    const count = await links.count()
    if (count === 0) {
      test.skip()
      return
    }

    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href')
      if (!href || href.includes('/new') || href.includes('/edit') || href.includes('/cook'))
        continue

      const id = href.match(/\/recipe\/([^/]+)/)?.[1]
      if (!id) continue

      await page.goto(`/recipe/${id}/cook`)
      await page.waitForTimeout(1000)

      const closeBtn = page.getByText('✕')
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click()
        await expect(page).toHaveURL(/\/recipe\/[^/]+$/, { timeout: 5000 })
        return
      }
    }
    test.skip()
  })
})
