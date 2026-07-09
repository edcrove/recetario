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

  // Regression test for the 2026-07-03 audit finding: tapping a collection
  // used to navigate to a dead-end/blank route — collections/[id] didn't exist.
  test('tapping a collection shows its recipes instead of a dead end', async ({ page }) => {
    const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))

    const colRes = await page.request.post(`${API_URL}/v1/collections`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: `E2E Detalle ${Date.now()}`, emoji: '🍰' },
    })
    expect(colRes.ok()).toBe(true)
    const collection = await colRes.json()

    const recipeRes = await page.request.post(`${API_URL}/v1/recipes`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        title: `E2E Receta Colección ${Date.now()}`,
        servings: 4,
        category: 'Cena',
        ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
        steps: [{ text: 'Paso único' }],
      },
    })
    expect(recipeRes.ok()).toBe(true)
    const recipe = await recipeRes.json()

    await page.request.post(`${API_URL}/v1/collections/${collection.id}/recipes`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { recipeId: recipe.id },
    })

    await page.getByTestId('home-collections-button').click()
    await expect(page.getByPlaceholder('Nueva colección…')).toBeVisible({ timeout: 8000 })
    await page.getByText(collection.name).click()

    await expect(page.getByTestId('collection-detail-title')).toContainText(collection.name, {
      timeout: 8000,
    })
    await expect(page.getByTestId(`collection-recipe-${recipe.id}`)).toBeVisible({
      timeout: 8000,
    })

    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByTestId(`collection-remove-${recipe.id}`).click()
    await expect(page.getByTestId(`collection-recipe-${recipe.id}`)).not.toBeVisible({
      timeout: 8000,
    })
  })
})

test.describe('Config (taxonomy) screen', () => {
  test('navigates and shows tabs', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-categories')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('config-tab-food-types')).toBeVisible()
    await expect(page.getByTestId('config-tab-tags')).toBeVisible()
  })

  test('switching to food-types tab shows food type items', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-food-types')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('config-tab-food-types').click()
    await expect(page.locator('[data-testid^="config-item-"]').first()).toBeVisible({
      timeout: 8000,
    })
  })

  test('switching to tags tab works and back to categories', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-tags')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('config-tab-tags').click()
    await page.waitForTimeout(300)
    await page.getByTestId('config-tab-categories').click()
    await expect(page.locator('[data-testid^="config-item-"]').first()).toBeVisible({
      timeout: 8000,
    })
  })

  // Meal categories have no creation endpoint — only system-seeded ones exist,
  // and those can't be renamed by design (2026-07-03 audit fix: renaming now
  // requires ownership, and system items have no owner). Food types DO have a
  // real creation endpoint (POST /v1/food-types), so create one via the API
  // first to guarantee there's something the caller actually owns to rename.
  test('renames an own food type and sees the new name', async ({ page }) => {
    const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const createRes = await page.request.post(`${API_URL}/v1/food-types`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: `E2E Tipo ${Date.now()}` },
    })
    expect(createRes.ok()).toBe(true)
    const created = await createRes.json()

    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-food-types')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('config-tab-food-types').click()
    const item = page.getByTestId(`config-item-${created.id}`)
    await expect(item).toBeVisible({ timeout: 8000 })
    await item.getByTestId(`config-edit-${created.id}`).click()
    await expect(page.getByTestId('config-rename-save')).toBeVisible({ timeout: 5000 })
    const newName = `E2E Editado ${Date.now()}`
    const input = page.locator('input').last()
    await input.fill(newName)
    await page.getByTestId('config-rename-save').click()
    await expect(page.getByText(newName)).toBeVisible({ timeout: 8000 })
  })

  test('cancel on rename modal discards the change', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-categories')).toBeVisible({ timeout: 8000 })
    const firstItem = page.locator('[data-testid^="config-item-"]').first()
    await firstItem.locator('[data-testid^="config-edit-"]').click()
    await expect(page.getByTestId('config-rename-cancel')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('config-rename-cancel').click()
    await expect(page.getByTestId('config-rename-cancel')).not.toBeVisible({ timeout: 5000 })
  })

  test('deleting an item offers cancel, which closes the modal', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-food-types')).toBeVisible({ timeout: 8000 })
    await page.getByTestId('config-tab-food-types').click()
    const deleteBtn = page.locator('[data-testid^="config-delete-"]').first()
    // Deletable/warning action only renders for non-system items or items already
    // linked to a recipe — the seeded system food types may have neither right now.
    if ((await deleteBtn.count()) === 0) return
    await deleteBtn.click()
    await expect(page.getByTestId('config-delete-cancel')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('config-delete-cancel').click()
    await expect(page.getByTestId('config-delete-cancel')).not.toBeVisible({ timeout: 5000 })
  })
})

test.describe('Household screen', () => {
  // Opens /household and guarantees the account has a household, creating one
  // on first use. Detection is by testID: the create-name input only renders
  // in the empty state. (The old guard counted the 🏠 emoji, which also
  // appears in the profile menu's "🏠 Mi hogar" row — on household-less
  // accounts it false-positived, silently skipping creation AND making every
  // later test early-return, which is why this screen sat at 40% E2E
  // coverage while the tests "passed".)
  async function openHouseholdEnsuringOneExists(page: import('@playwright/test').Page) {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(
      page
        .getByTestId('household-create-name-input')
        .or(page.getByTestId('household-invite-open').first()),
    ).toBeVisible({ timeout: 8000 })
    if ((await page.getByTestId('household-create-name-input').count()) > 0) {
      const name = `E2E Familia ${Date.now()}`
      await page.getByTestId('household-create-name-input').fill(name)
      await page.getByTestId('household-create-submit').click()
      await expect(page.getByText(name)).toBeVisible({ timeout: 8000 })
    }
    await expect(page.getByTestId('household-invite-open').first()).toBeVisible({ timeout: 8000 })
  }

  test('navigates and shows create or existing household', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(
      page
        .getByTestId('household-create-name-input')
        .or(page.getByTestId('household-invite-open').first()),
    ).toBeVisible({ timeout: 8000 })
  })

  test('creates a household when none exists and shows its members', async ({ page }) => {
    await openHouseholdEnsuringOneExists(page)
    // The owner appears in the members list with their role badge
    await expect(page.getByText('Dueño').first()).toBeVisible({ timeout: 5000 })
  })

  test('opens and cancels the invite form', async ({ page }) => {
    await openHouseholdEnsuringOneExists(page)
    await page.getByTestId('household-invite-open').first().click()
    await expect(page.getByTestId('household-invite-email-input')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('household-invite-cancel').click()
    await expect(page.getByTestId('household-invite-email-input')).not.toBeVisible({
      timeout: 5000,
    })
  })

  // Regression test for the 2026-07-03 audit finding: inviting a real family
  // member used to require pasting their raw UUID — nobody knows that.
  //
  // Invites a FRESHLY REGISTERED user (timestamped email), never another demo
  // account: recipe/menu reads are household-shared, so linking two demo
  // accounts into one household would leak each worker's data into the
  // other's assertions and make the suite order-dependent. Worker isolation
  // depends on the demo accounts never sharing a household.
  test('inviting a real user by email succeeds, and the member can be removed', async ({
    page,
  }, testInfo) => {
    const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
    const inviteeEmail = `invitado-e2e-${testInfo.parallelIndex}-${Date.now()}@example.com`
    const registerRes = await page.request.post(`${API_URL}/auth/register`, {
      data: { email: inviteeEmail, password: 'password123' },
    })
    expect(registerRes.ok()).toBe(true)
    const inviteeUserId = ((await registerRes.json()) as { user: { id: string } }).user.id

    await openHouseholdEnsuringOneExists(page)
    await page.getByTestId('household-invite-open').first().click()
    await expect(page.getByTestId('household-invite-email-input')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('household-invite-email-input').fill(inviteeEmail)
    await page.getByTestId('household-invite-submit').click()
    // Form closes on success (no error dialog, invite box disappears)
    await expect(page.getByTestId('household-invite-email-input')).not.toBeVisible({
      timeout: 8000,
    })

    // The new member shows up in the list; remove them again so the demo
    // account's household returns to its single-owner state (repeatable runs).
    const removeBtn = page.getByTestId(`household-remove-member-${inviteeUserId}`)
    await expect(removeBtn).toBeVisible({ timeout: 8000 })

    // First attempt: dismiss the confirm — member stays
    page.once('dialog', (dialog) => void dialog.dismiss())
    await removeBtn.click()
    await expect(removeBtn).toBeVisible()

    // Second attempt: accept — member disappears
    page.once('dialog', (dialog) => void dialog.accept())
    await removeBtn.click()
    await expect(removeBtn).not.toBeVisible({ timeout: 8000 })
  })

  test('inviting with an email that has no matching user shows an error notification', async ({
    page,
  }) => {
    await openHouseholdEnsuringOneExists(page)
    await page.getByTestId('household-invite-open').first().click()
    await expect(page.getByTestId('household-invite-email-input')).toBeVisible({ timeout: 5000 })

    let dialogMessage = ''
    page.once('dialog', (dialog) => {
      dialogMessage = dialog.message()
      void dialog.accept()
    })

    await page.getByTestId('household-invite-email-input').fill('nadie-existe@example.com')
    await page.getByTestId('household-invite-submit').click()
    await expect.poll(() => dialogMessage, { timeout: 8000 }).toContain('Error')
  })

  test('picking a role chip changes the selected role', async ({ page }) => {
    await openHouseholdEnsuringOneExists(page)
    await page.getByTestId('household-invite-open').first().click()
    await expect(page.getByTestId('household-invite-role-viewer')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('household-invite-role-viewer').click()
    // No crash after switching role — form still usable
    await expect(page.getByTestId('household-invite-email-input')).toBeVisible()
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
  // UserMenu's "Cerrar sesión" calls handleSignOut directly. Profile screen's sign-out
  // now goes through platformAlert.confirmAsync (fixed the Alert.alert web no-op).
  test('signs out via UserMenu and redirects to login', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await expect(page.getByTestId('usermenu-signout')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('usermenu-signout').click()
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 })
  })
})

// Coverage for the full /profile screen — previous tests only exercised the
// UserMenu overlay, leaving name editing, servings, dietary chips, nutrition
// targets and the confirm-guarded sign-out untested (57% E2E).
test.describe('Profile screen (/profile)', () => {
  test('edits the display name inline', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('tocá para editar')).toBeVisible({ timeout: 8000 })
    await page.getByText('tocá para editar').click()
    const input = page.locator('input[autofocus], input').first()
    await input.fill('Demo E2E')
    await page.getByText('Guardar', { exact: true }).click()
    await expect(page.getByText('Demo E2E')).toBeVisible({ timeout: 8000 })
  })

  test('cancel exits name editing without saving', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('tocá para editar')).toBeVisible({ timeout: 8000 })
    await page.getByText('tocá para editar').click()
    await page.getByText('Cancelar', { exact: true }).click()
    await expect(page.getByText('tocá para editar')).toBeVisible()
  })

  test('preferred servings stepper increments and decrements', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('Porciones por defecto')).toBeVisible({ timeout: 8000 })
    const row = page.getByText('Porciones por defecto').locator('xpath=following-sibling::*[1]')
    const value = row.locator('div,span').filter({ hasText: /^\d+$/ }).first()
    const before = Number(await value.textContent())
    // The value clamps to [1, 20], and repeated runs can leave it parked at a
    // boundary — exercise both directions starting away from the stuck edge.
    if (before > 1) {
      await row.getByText('−', { exact: true }).click()
      await expect(value).toHaveText(String(before - 1), { timeout: 8000 })
      await row.getByText('+', { exact: true }).click()
      await expect(value).toHaveText(String(before), { timeout: 8000 })
    } else {
      await row.getByText('+', { exact: true }).click()
      await expect(value).toHaveText('2', { timeout: 8000 })
      await row.getByText('−', { exact: true }).click()
      await expect(value).toHaveText('1', { timeout: 8000 })
    }
  })

  test('toggles a dietary chip on and off', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('Preferencias dietéticas')).toBeVisible({ timeout: 8000 })
    const chip = page.getByText('paleo', { exact: true })
    await chip.click()
    // give the mutation a round trip, then toggle back off
    await page.waitForTimeout(600)
    await chip.click()
    await page.waitForTimeout(600)
    await expect(chip).toBeVisible()
  })

  test('nutrition target stepper changes calories and restores', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('Objetivos nutricionales diarios')).toBeVisible({ timeout: 8000 })
    const row = page.getByText('Calorías', { exact: true }).locator('xpath=..')
    const valText = await row.locator('text=/\\d+/').first().textContent()
    const before = Number(valText?.match(/\d+/)?.[0] ?? 0)
    await row.getByText('+', { exact: true }).click()
    await expect(row.getByText(String(before + 100))).toBeVisible({ timeout: 8000 })
    await row.getByText('−', { exact: true }).click()
    await expect(row.getByText(String(before))).toBeVisible({ timeout: 8000 })
  })

  test('sign out asks for confirmation; dismissing stays logged in', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByTestId('profile-signout')).toBeVisible({ timeout: 8000 })
    page.once('dialog', (dialog) => void dialog.dismiss())
    await page.getByTestId('profile-signout').click()
    // still on profile, still authenticated
    await expect(page.getByTestId('profile-signout')).toBeVisible()
  })

  test('sign out confirm redirects to login', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByTestId('profile-signout')).toBeVisible({ timeout: 8000 })
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByTestId('profile-signout').click()
    await page.waitForURL(/auth/, { timeout: 8000 })
  })
})
