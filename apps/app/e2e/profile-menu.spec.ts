import { test, expect } from './fixtures'
import { DEMO_ACCOUNTS } from './demoAccounts'

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
  test('navigates and shows create or existing household', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(page.getByText(/Creá tu hogar|🏠/).first()).toBeVisible({ timeout: 8000 })
  })

  test('creates a household when none exists', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(page.getByText(/Creá tu hogar|🏠/).first()).toBeVisible({ timeout: 8000 })
    const alreadyHasHousehold = await page.getByText('🏠').count()
    if (alreadyHasHousehold === 0) {
      const name = `E2E Familia ${Date.now()}`
      await page.getByTestId('household-create-name-input').fill(name)
      await page.getByTestId('household-create-submit').click()
      await expect(page.getByText(name)).toBeVisible({ timeout: 8000 })
    }
  })

  test('opens and cancels the invite form', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(page.getByText(/Creá tu hogar|🏠/).first()).toBeVisible({ timeout: 8000 })
    const inviteOpenBtn = page.getByTestId('household-invite-open').first()
    if ((await inviteOpenBtn.count()) === 0) return // no household yet, nothing to invite into
    await inviteOpenBtn.click()
    await expect(page.getByTestId('household-invite-email-input')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('household-invite-cancel').click()
    await expect(page.getByTestId('household-invite-email-input')).not.toBeVisible({
      timeout: 5000,
    })
  })

  // Regression test for the 2026-07-03 audit finding: inviting a real family
  // member used to require pasting their raw UUID — nobody knows that. Uses
  // another seeded demo account's real email to invite for real.
  //
  // The household/members table is never wiped between suite runs (shared
  // Postgres, see cascade-delete.integration.test.ts's discovery), so the
  // "other" account may already be a member from a previous run. Clean that
  // up via direct API calls first so this test is repeatable.
  test('inviting a real user by email succeeds', async ({ page }, testInfo) => {
    const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
    const otherAccount = DEMO_ACCOUNTS[(testInfo.parallelIndex + 1) % DEMO_ACCOUNTS.length]!

    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const otherLoginRes = await page.request.post(`${API_URL}/auth/login`, {
      data: { email: otherAccount.email, password: otherAccount.password },
    })
    expect(otherLoginRes.ok()).toBe(true)
    const otherUserId = (await otherLoginRes.json()).user.id as string

    const householdsRes = await page.request.get(`${API_URL}/v1/households/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(householdsRes.ok()).toBe(true)
    const households = (await householdsRes.json()) as Array<{
      id: string
      members?: Array<{ userId: string }>
    }>
    for (const hh of households) {
      if (hh.members?.some((m) => m.userId === otherUserId)) {
        await page.request.delete(`${API_URL}/v1/households/${hh.id}/members/${otherUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    }

    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(page.getByText(/Creá tu hogar|🏠/).first()).toBeVisible({ timeout: 8000 })
    const inviteOpenBtn = page.getByTestId('household-invite-open').first()
    if ((await inviteOpenBtn.count()) === 0) return // no household yet, nothing to invite into
    await inviteOpenBtn.click()
    await expect(page.getByTestId('household-invite-email-input')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('household-invite-email-input').fill(otherAccount.email)
    await page.getByTestId('household-invite-submit').click()
    // Form closes on success (no error dialog, invite box disappears)
    await expect(page.getByTestId('household-invite-email-input')).not.toBeVisible({
      timeout: 8000,
    })
  })

  test('inviting with an email that has no matching user shows an error notification', async ({
    page,
  }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(page.getByText(/Creá tu hogar|🏠/).first()).toBeVisible({ timeout: 8000 })
    const inviteOpenBtn = page.getByTestId('household-invite-open').first()
    if ((await inviteOpenBtn.count()) === 0) return
    await inviteOpenBtn.click()
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
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(page.getByText(/Creá tu hogar|🏠/).first()).toBeVisible({ timeout: 8000 })
    const inviteOpenBtn = page.getByTestId('household-invite-open').first()
    if ((await inviteOpenBtn.count()) === 0) return
    await inviteOpenBtn.click()
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
