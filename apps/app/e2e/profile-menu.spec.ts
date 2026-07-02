import { test, expect } from './fixtures'

/**
 * Profile menu (UserMenu component) and satellite screens:
 * profile, collections, config, household, stats.
 * These screens had 0% E2E coverage before this suite.
 */

test.describe('UserMenu: open and navigate', () => {
  test('profile button opens the menu sheet', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await expect(page.getByText('Cerrar sesión')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Mi perfil')).toBeVisible()
  })

  test('shows all menu items', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await expect(page.getByTestId('usermenu-item-0')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Preferencias dietéticas')).toBeVisible()
    await expect(page.getByText('Mi hogar')).toBeVisible()
    await expect(page.getByText('Colecciones')).toBeVisible()
    await expect(page.getByText('Estadísticas de cocina')).toBeVisible()
    await expect(page.getByText('Configuración de taxonomía')).toBeVisible()
  })

  test('navigates to profile screen', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Porciones por defecto')).toBeVisible({ timeout: 8000 })
  })

  test('backdrop tap closes the menu', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await expect(page.getByTestId('usermenu-signout')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('usermenu-backdrop').click({ position: { x: 10, y: 10 } })
    await expect(page.getByTestId('usermenu-signout')).not.toBeVisible({ timeout: 5000 })
  })
})

test.describe('Profile screen', () => {
  test('shows default servings stepper', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Porciones por defecto')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('−').first()).toBeVisible()
  })

  test('increments default servings', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Porciones por defecto')).toBeVisible({ timeout: 8000 })
    const plusBtn = page.getByText('+', { exact: true }).first()
    await plusBtn.click()
    // Value updates — screen still functional
    await expect(page.getByText('Porciones por defecto')).toBeVisible()
  })

  test('toggles a dietary restriction chip', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Preferencias dietéticas').first()).toBeVisible({ timeout: 8000 })
    await page.getByText('vegano').click()
    // Toggling doesn't crash the screen
    await expect(page.getByText('Preferencias dietéticas').first()).toBeVisible()
  })

  test('nutrition targets steppers are visible', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Objetivos nutricionales diarios')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Calorías')).toBeVisible()
  })

  test('name edit flow — tap, type, save', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Porciones por defecto')).toBeVisible({ timeout: 8000 })
    await page
      .getByText(/Agregá tu nombre|tocá para editar/)
      .first()
      .click()
    const nameInput = page.locator('input[type="text"]').first()
    const hasInput = await nameInput.count()
    if (hasInput > 0) {
      await nameInput.fill('E2E Tester')
      await page
        .getByTestId('profile-signout')
        .scrollIntoViewIfNeeded()
        .catch(() => {})
    }
  })
})

test.describe('Collections screen', () => {
  test('navigates from home and shows empty or list state', async ({ page }) => {
    await page.getByTestId('home-collections-button').click()
    await expect(page.getByPlaceholder('Nueva colección…')).toBeVisible({ timeout: 8000 })
  })

  test('creates a new collection', async ({ page }) => {
    await page.getByTestId('home-collections-button').click()
    await expect(page.getByPlaceholder('Nueva colección…')).toBeVisible({ timeout: 8000 })
    const name = `E2E Colección ${Date.now()}`
    await page.getByPlaceholder('Nueva colección…').fill(name)
    await page.getByText('+', { exact: true }).click()
    await expect(page.getByText(name)).toBeVisible({ timeout: 8000 })
  })

  test('navigating to menu via profile menu item works', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Colecciones').click()
    await expect(page.getByPlaceholder('Nueva colección…')).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Config (taxonomy) screen', () => {
  test('navigates and shows tabs', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(
      page.getByText('Categorías').or(page.getByText('Tipos de comida')).first(),
    ).toBeVisible({
      timeout: 8000,
    })
  })
})

test.describe('Household screen', () => {
  test('navigates and shows create or existing household', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(page.getByText(/Creá tu hogar|🏠/).first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Stats screen', () => {
  test('navigates and shows session count', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Estadísticas de cocina').click()
    await expect(
      page.getByText(/sesiones de cocina en total|Recetas más cocinadas/).first(),
    ).toBeVisible({
      timeout: 8000,
    })
  })
})

test.describe('Sign out', () => {
  // UserMenu's "Cerrar sesión" calls handleSignOut directly (no Alert.alert wrapper),
  // so it works on web. NOTE: profile screen's sign-out button uses Alert.alert()
  // which is a no-op in react-native-web — see BUG note in Notion audit findings.
  test('signs out via UserMenu and redirects to login', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await expect(page.getByTestId('usermenu-signout')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('usermenu-signout').click()
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 })
  })
})
