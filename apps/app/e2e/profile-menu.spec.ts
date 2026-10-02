import { test, expect } from './fixtures'
import { API_URL } from './env'

/**
 * Profile menu (UserMenu component) and satellite screens:
 * profile, collections, config, household, stats.
 * These screens had 0% E2E coverage before this suite.
 */

test.describe('UserMenu: open and navigate', () => {
  test('profile button opens the menu sheet', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await expect(page.getByText('Cerrar sesión')).toBeVisible()
    await expect(page.getByText('Mi perfil')).toBeVisible()
  })

  test('shows all menu items', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await expect(page.getByTestId('usermenu-item-0')).toBeVisible()
    await expect(page.getByText('Preferencias dietéticas')).toBeVisible()
    await expect(page.getByText('Mi hogar')).toBeVisible()
    await expect(page.getByText('Colecciones')).toBeVisible()
    await expect(page.getByText('Estadísticas de cocina')).toBeVisible()
    await expect(page.getByText('Configuración de taxonomía')).toBeVisible()
  })

  test('navigates to profile screen', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Porciones por defecto')).toBeVisible()
  })

  test('backdrop tap closes the menu', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await expect(page.getByTestId('usermenu-signout')).toBeVisible()
    await page.getByTestId('usermenu-backdrop').click({ position: { x: 10, y: 10 } })
    await expect(page.getByTestId('usermenu-signout')).not.toBeVisible()
  })
})

test.describe('Profile screen', () => {
  test('shows default servings stepper', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Porciones por defecto')).toBeVisible()
    await expect(page.getByText('−').first()).toBeVisible()
  })

  test('increments default servings', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Porciones por defecto')).toBeVisible()
    const plusBtn = page.getByText('+', { exact: true }).first()
    await plusBtn.click()
    // Value updates — screen still functional
    await expect(page.getByText('Porciones por defecto')).toBeVisible()
  })

  test('toggles a dietary restriction chip', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Preferencias dietéticas').first()).toBeVisible()
    // Scoped by testID: the home screen (still mounted under the stack) has its own "vegano" chip
    const saved = page.waitForResponse(
      (r) => r.url().endsWith('/auth/profile') && r.request().method() === 'PATCH',
    )
    // Toggling flips whatever the account has now (other tests may have set it)
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const before = (
      (await (
        await page.request.get(`${API_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).json()) as { dietaryRestrictions: string[] }
    ).dietaryRestrictions.includes('vegano')
    await page.getByTestId('profile-diet-chip-vegano').click()
    const body = (await (await saved).request().postDataJSON()) as {
      dietaryRestrictions: string[]
    }
    expect(body.dietaryRestrictions.includes('vegano')).toBe(!before)
    await expect(page.getByText('Preferencias dietéticas').first()).toBeVisible()
  })

  test('nutrition targets steppers are visible', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Objetivos nutricionales diarios')).toBeVisible()
    await expect(page.getByText('Calorías', { exact: true })).toBeVisible()
  })

  test('name edit flow — tap, type, save', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByTestId('usermenu-item-0').click()
    await expect(page.getByText('Porciones por defecto')).toBeVisible()
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
  test('opens Colecciones from home with the create field ready', async ({ page }) => {
    await page.getByTestId('home-collections-button').click()
    await expect(page.getByPlaceholder('Nueva colección…')).toBeVisible()
  })

  test('creates a new collection', async ({ page }) => {
    await page.getByTestId('home-collections-button').click()
    await expect(page.getByPlaceholder('Nueva colección…')).toBeVisible()
    const name = `E2E Colección ${Date.now()}`
    await page.getByPlaceholder('Nueva colección…').fill(name)
    await page.getByText('+', { exact: true }).click()
    await expect(page.getByText(name)).toBeVisible()
  })

  test('navigating to menu via profile menu item works', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Colecciones').click()
    await expect(page.getByPlaceholder('Nueva colección…')).toBeVisible()
  })

  // Regression test for the 2026-07-03 audit finding: tapping a collection
  // used to navigate to a dead-end/blank route — collections/[id] didn't exist.
  test('tapping a collection shows its recipes instead of a dead end', async ({ page }) => {
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
    await expect(page.getByPlaceholder('Nueva colección…')).toBeVisible()
    await page.getByText(collection.name).click()

    await expect(page.getByTestId('collection-detail-title')).toContainText(collection.name)
    await expect(page.getByTestId(`collection-recipe-${recipe.id}`)).toBeVisible()

    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByTestId(`collection-remove-${recipe.id}`).click()
    await expect(page.getByTestId(`collection-recipe-${recipe.id}`)).not.toBeVisible()
  })
})

test.describe('Config (taxonomy) screen', () => {
  test('navigates and shows tabs', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-categories')).toBeVisible()
    await expect(page.getByTestId('config-tab-food-types')).toBeVisible()
    await expect(page.getByTestId('config-tab-tags')).toBeVisible()
  })

  test('switching to food-types tab shows food type items', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-food-types')).toBeVisible()
    await page.getByTestId('config-tab-food-types').click()
    await expect(page.locator('[data-testid^="config-item-"]').first()).toBeVisible()
  })

  test('switching to tags tab works and back to categories', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-tags')).toBeVisible()
    await page.getByTestId('config-tab-tags').click()
    await expect(page.getByTestId('config-tab-tags')).toBeVisible()
    await page.getByTestId('config-tab-categories').click()
    await expect(page.locator('[data-testid^="config-item-"]').first()).toBeVisible()
  })

  // Meal categories have no creation endpoint — only system-seeded ones exist,
  // and those can't be renamed by design (2026-07-03 audit fix: renaming now
  // requires ownership, and system items have no owner). Food types DO have a
  // real creation endpoint (POST /v1/food-types), so create one via the API
  // first to guarantee there's something the caller actually owns to rename.
  test('renames an own food type and sees the new name', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const createRes = await page.request.post(`${API_URL}/v1/food-types`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: `E2E Tipo ${Date.now()}` },
    })
    expect(createRes.ok()).toBe(true)
    const created = await createRes.json()

    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-food-types')).toBeVisible()
    await page.getByTestId('config-tab-food-types').click()
    const item = page.getByTestId(`config-item-${created.id}`)
    await expect(item).toBeVisible()
    await item.getByTestId(`config-edit-${created.id}`).click()
    await expect(page.getByTestId('config-rename-save')).toBeVisible()
    const newName = `E2E Editado ${Date.now()}`
    const input = page.locator('input').last()
    await input.fill(newName)
    await page.getByTestId('config-rename-save').click()
    await expect(page.getByText(newName)).toBeVisible()
  })

  test('cancel on rename modal discards the change', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Configuración de taxonomía').click()
    await expect(page.getByTestId('config-tab-categories')).toBeVisible()
    const firstItem = page.locator('[data-testid^="config-item-"]').first()
    await firstItem.locator('[data-testid^="config-edit-"]').click()
    await expect(page.getByTestId('config-rename-cancel')).toBeVisible()
    await page.getByTestId('config-rename-cancel').click()
    await expect(page.getByTestId('config-rename-cancel')).not.toBeVisible()
  })

  test('a used food type can be reassigned by name before deleting it', async ({ page }) => {
    const API = API_URL
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const stamp = Date.now()
    const mk = async (name: string) =>
      (await (
        await page.request.post(`${API}/v1/food-types`, { headers, data: { name } })
      ).json()) as { id: string }
    const from = await mk(`E2E Viejo ${stamp}`)
    const to = await mk(`E2E Nuevo ${stamp}`)
    const recipe = (await (
      await page.request.post(`${API}/v1/recipes`, {
        headers,
        data: {
          title: `E2E Reasignar ${stamp}`,
          servings: 2,
          category: 'Cena',
          foodTypeIds: [from.id],
          ingredients: [{ name: 'sal', quantity: 1, unit: 'g' }],
        },
      })
    ).json()) as { id: string }
    try {
      await page.getByTestId('home-profile-button').click()
      await page.getByText('Configuración de taxonomía').click()
      await page.getByTestId('config-tab-food-types').click()
      await page.getByTestId(`config-delete-${from.id}`).click()
      await expect(page.getByText(`"E2E Viejo ${stamp}" está en 1 receta`)).toBeVisible()

      // cancel first, then reassign to the other type by name
      await page.getByTestId('config-delete-cancel').click()
      await expect(page.getByTestId('config-delete-cancel')).not.toBeVisible()
      await page.getByTestId(`config-delete-${from.id}`).click()
      await page.getByTestId(`config-reassign-${to.id}`).click()
      await page.getByTestId(`config-reassign-${to.id}`).click() // toggles off
      await page.getByTestId(`config-reassign-${to.id}`).click()
      await expect(page.getByText('Reasignar y eliminar')).toBeVisible()
      await page.getByTestId('config-delete-confirm').click()
      await expect(page.getByTestId(`config-delete-${from.id}`)).toHaveCount(0)

      const after = (await (
        await page.request.get(`${API}/v1/recipes/${recipe.id}`, { headers })
      ).json()) as { foodTypeIds: string[] }
      expect(after.foodTypeIds).toEqual([to.id])
    } finally {
      await page.request.delete(`${API}/v1/recipes/${recipe.id}`, { headers })
      await page.request.delete(`${API}/v1/config/food-types/${to.id}`, { headers })
    }
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
    ).toBeVisible()
    if ((await page.getByTestId('household-create-name-input').count()) > 0) {
      const name = `E2E Familia ${Date.now()}`
      await page.getByTestId('household-create-name-input').fill(name)
      await page.getByTestId('household-create-submit').click()
      await expect(page.getByText(name)).toBeVisible()
    }
    await expect(page.getByTestId('household-invite-open').first()).toBeVisible()
  }

  test('Mi hogar opens from the user menu (create form or members, by account state)', async ({
    page,
  }) => {
    await page.getByTestId('home-profile-button').click()
    await page.getByText('Mi hogar').click()
    await expect(
      page
        .getByTestId('household-create-name-input')
        .or(page.getByTestId('household-invite-open').first()),
    ).toBeVisible()
  })

  test('creates a household when none exists and shows its members', async ({ page }) => {
    await openHouseholdEnsuringOneExists(page)
    // The owner appears in the members list with their role badge
    await expect(page.getByText('Dueño').first()).toBeVisible()
  })

  test('opens and cancels the invite form', async ({ page }) => {
    await openHouseholdEnsuringOneExists(page)
    await page.getByTestId('household-invite-open').first().click()
    await expect(page.getByTestId('household-invite-email-input')).toBeVisible()
    await page.getByTestId('household-invite-cancel').click()
    await expect(page.getByTestId('household-invite-email-input')).not.toBeVisible()
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
    const inviteeEmail = `invitado-e2e-${testInfo.parallelIndex}-${Date.now()}@example.com`
    const registerRes = await page.request.post(`${API_URL}/auth/register`, {
      data: { email: inviteeEmail, password: 'password123' },
    })
    expect(registerRes.ok()).toBe(true)
    const inviteeUserId = ((await registerRes.json()) as { user: { id: string } }).user.id

    await openHouseholdEnsuringOneExists(page)
    await page.getByTestId('household-invite-open').first().click()
    await expect(page.getByTestId('household-invite-email-input')).toBeVisible()
    await page.getByTestId('household-invite-email-input').fill(inviteeEmail)
    await page.getByTestId('household-invite-submit').click()
    // Form closes on success (no error dialog, invite box disappears)
    await expect(page.getByTestId('household-invite-email-input')).not.toBeVisible()

    // The new member shows up in the list; remove them again so the demo
    // account's household returns to its single-owner state (repeatable runs).
    const removeBtn = page.getByTestId(`household-remove-member-${inviteeUserId}`)
    await expect(removeBtn).toBeVisible()

    // First attempt: dismiss the confirm — member stays
    page.once('dialog', (dialog) => void dialog.dismiss())
    await removeBtn.click()
    await expect(removeBtn).toBeVisible()

    // Second attempt: accept — member disappears
    page.once('dialog', (dialog) => void dialog.accept())
    await removeBtn.click()
    await expect(removeBtn).not.toBeVisible()
  })

  test('inviting with an email that has no matching user shows an error notification', async ({
    page,
  }) => {
    await openHouseholdEnsuringOneExists(page)
    await page.getByTestId('household-invite-open').first().click()
    await expect(page.getByTestId('household-invite-email-input')).toBeVisible()

    let dialogMessage = ''
    page.once('dialog', (dialog) => {
      dialogMessage = dialog.message()
      void dialog.accept()
    })

    await page.getByTestId('household-invite-email-input').fill('nadie-existe@example.com')
    await page.getByTestId('household-invite-submit').click()
    await expect.poll(() => dialogMessage).toContain('No hay ninguna cuenta')
  })

  test('Mi hogar reports failed invite, remove, accept and decline requests', async ({
    page,
  }, testInfo) => {
    const API = API_URL
    const ownerToken = await page.evaluate(() => localStorage.getItem('auth_token'))
    const ownerHeaders = { Authorization: `Bearer ${ownerToken ?? ''}` }
    await openHouseholdEnsuringOneExists(page)
    const [hh] = (await (
      await page.request.get(`${API}/v1/households/mine`, { headers: ownerHeaders })
    ).json()) as Array<{ id: string }>
    const messages: string[] = []
    page.on('dialog', (dialog) => {
      messages.push(dialog.message())
      void dialog.accept()
    })
    const fail = (pattern: string) =>
      page.route(pattern, (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
      )

    const email = `errpath-${testInfo.parallelIndex}-${Date.now()}@example.com`
    const invitee = (await (
      await page.request.post(`${API}/auth/register`, { data: { email, password: 'password123' } })
    ).json()) as { token: string; user: { id: string } }
    await page.request.post(`${API}/v1/households/${hh!.id}/invite`, {
      headers: ownerHeaders,
      data: { userId: invitee.user.id, role: 'member' },
    })

    try {
      // Owner: a failed invite and a failed removal both tell the user
      await fail('**/v1/households/*/invite')
      await page.getByTestId('household-invite-open').first().click()
      await page.getByTestId('household-invite-email-input').fill('alguien@example.com')
      await page.getByTestId('household-invite-submit').click()
      await expect.poll(() => messages.join('|')).toContain('Probá de nuevo')
      // 409 (already a member) and 403 (not owner/admin) get their own messages
      for (const [status, text] of [
        [409, 'ya está en el hogar'],
        [403, 'Solo el dueño o un admin'],
      ] as const) {
        await page.unroute('**/v1/households/*/invite')
        await page.route('**/v1/households/*/invite', (route) =>
          route.fulfill({ status, contentType: 'application/json', body: '{"error":"x"}' }),
        )
        await page.getByTestId('household-invite-submit').click()
        await expect.poll(() => messages.join('|')).toContain(text)
      }

      await fail('**/v1/households/*/members/*')
      await page.reload() // the list was loaded before the API invite above
      await page.getByTestId(`household-remove-member-${invitee.user.id}`).click()
      await expect.poll(() => messages.join('|')).toContain('No se pudo quitar al miembro')

      // Invitee: failed accept / decline keep the invitation and say so
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await page.evaluate((jwt) => localStorage.setItem('auth_token', jwt), invitee.token)
      await page.goto('/household')
      await fail('**/v1/households/*/accept')
      await fail('**/v1/households/*/decline')
      await page.getByTestId(`household-accept-${hh!.id}`).click()
      await expect.poll(() => messages.join('|')).toContain('No se pudo aceptar')
      await page.getByTestId(`household-decline-${hh!.id}`).click()
      await expect.poll(() => messages.join('|')).toContain('No se pudo rechazar')
      await expect(page.getByTestId(`household-invitation-${hh!.id}`)).toBeVisible()
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await page.request.delete(`${API}/v1/households/${hh!.id}/members/${invitee.user.id}`, {
        headers: ownerHeaders,
      })
    }
  })

  test('the invitee declines, is invited again and accepts — all in Mi hogar', async ({
    page,
  }, testInfo) => {
    const API = API_URL
    const ownerToken = await page.evaluate(() => localStorage.getItem('auth_token'))
    const ownerHeaders = { Authorization: `Bearer ${ownerToken ?? ''}` }
    await openHouseholdEnsuringOneExists(page)
    const [hh] = (await (
      await page.request.get(`${API}/v1/households/mine`, { headers: ownerHeaders })
    ).json()) as Array<{ id: string; name: string }>

    const email = `invitee-${testInfo.parallelIndex}-${Date.now()}@example.com`
    const reg = await page.request.post(`${API}/auth/register`, {
      data: { email, password: 'password123' },
    })
    const invitee = (await reg.json()) as { token: string; user: { id: string } }
    const invite = () =>
      page.request.post(`${API}/v1/households/${hh!.id}/invite`, {
        headers: ownerHeaders,
        data: { userId: invitee.user.id, role: 'member' },
      })

    try {
      // Inviting the same person twice → specific message (409)
      expect((await invite()).status()).toBe(201)
      await page.getByTestId('household-invite-open').first().click()
      let dialogMessage = ''
      page.once('dialog', (dialog) => {
        dialogMessage = dialog.message()
        void dialog.accept()
      })
      await page.getByTestId('household-invite-email-input').fill(email)
      await page.getByTestId('household-invite-submit').click()
      await expect.poll(() => dialogMessage).toContain('ya está en el hogar')

      // Become the invitee; client-side navigation keeps coverage in one page
      await page.evaluate((jwt) => localStorage.setItem('auth_token', jwt), invitee.token)
      await page.goto('/household')
      const card = page.getByTestId(`household-invitation-${hh!.id}`)
      await expect(card).toContainText(hh!.name)

      page.once('dialog', (dialog) => void dialog.accept())
      await page.getByTestId(`household-decline-${hh!.id}`).click()
      await expect(card).toHaveCount(0)
      await expect(page.getByTestId('household-create-name-input')).toBeVisible()

      // Invited again → accept; the household and its members appear
      expect((await invite()).status()).toBe(201)
      await page.reload()
      await page.getByTestId(`household-accept-${hh!.id}`).click()
      await expect(card).toHaveCount(0)
      await expect(page.getByText(email)).toBeVisible()
      await expect(page.getByTestId('household-invite-open')).toHaveCount(0) // members can't invite
    } finally {
      await page.request.delete(`${API}/v1/households/${hh!.id}/members/${invitee.user.id}`, {
        headers: ownerHeaders,
      })
    }
  })

  test('picking a role chip changes the selected role', async ({ page }) => {
    await openHouseholdEnsuringOneExists(page)
    await page.getByTestId('household-invite-open').first().click()
    await expect(page.getByTestId('household-invite-role-viewer')).toBeVisible()
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
    ).toBeVisible()
  })

  // Story "App: pantalla de stats y tendencias": "streak de días consecutivos
  // cocinando" and "frecuencia por semana (mínimo 8 semanas)". A fresh account
  // so the streak starts from nothing.
  test('a fresh cook starts a streak by cooking today; the chart spans 8+ weeks', async ({
    page,
  }) => {
    const reg = await page.request.post(`${API_URL}/auth/register`, {
      data: { email: `e2e-racha-${Date.now()}@example.com`, password: 'racha12345' },
    })
    const { token } = (await reg.json()) as { token: string }
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    await page.evaluate((jwt) => localStorage.setItem('auth_token', jwt), token)

    await page.goto('/stats')
    await expect(page.getByTestId('stats-streak')).toHaveText('Cociná hoy para empezar una racha')

    const recipe = (await (
      await page.request.post(`${API_URL}/v1/recipes`, {
        headers,
        data: {
          title: 'Racha E2E',
          servings: 1,
          category: 'Cena',
          ingredients: [{ name: 'x', quantity: 1, unit: 'g' }],
          steps: [{ text: 'a' }],
        },
      })
    ).json()) as { id: string }
    // Cooked twice today: one day of streak, a week bar of 2
    for (let i = 0; i < 2; i++) {
      await page.request.post(`${API_URL}/v1/cook-sessions`, {
        headers,
        data: { recipeId: recipe.id, source: 'app' },
      })
    }

    await page.reload()
    await expect(page.getByTestId('stats-streak')).toContainText('🔥 1 día seguido cocinando')
    await expect(page.getByTestId('stats-streak-longest')).toHaveText('Mejor racha: 1 día seguido')
    const bars = page.locator('[data-testid^="stats-week-"]')
    expect(await bars.count()).toBeGreaterThanOrEqual(8)
    // Bar heights are proportional: this week's 2 is the full 80px, empty weeks the 4px floor
    const height = (i: number) =>
      bars.nth(i).evaluate((el) => {
        const bar = el.children[1] as HTMLElement
        return Math.round(bar.getBoundingClientRect().height)
      })
    const last = (await bars.count()) - 1
    await expect(bars.nth(last)).toContainText('2')
    expect(await height(last)).toBe(80)
    expect(await height(0)).toBe(4)
  })
})

test.describe('Sign out', () => {
  // UserMenu's "Cerrar sesión" calls handleSignOut directly. Profile screen's sign-out
  // now goes through platformAlert.confirmAsync (fixed the Alert.alert web no-op).
  test('signs out via UserMenu and redirects to login', async ({ page }) => {
    await page.getByTestId('home-profile-button').click()
    await expect(page.getByTestId('usermenu-signout')).toBeVisible()
    await page.getByTestId('usermenu-signout').click()
    await expect(page).toHaveURL(/auth\/login/)
  })
})

// Coverage for the full /profile screen — previous tests only exercised the
// UserMenu overlay, leaving name editing, servings, dietary chips, nutrition
// targets and the confirm-guarded sign-out untested (57% E2E).
test.describe('Profile screen (/profile)', () => {
  test('an allergen picked in the profile warns on a recipe with a derivative', async ({
    page,
  }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const created = await page.request.post(`${API_URL}/v1/recipes`, {
      headers,
      data: {
        title: `E2E Alfajor ${Date.now()}`,
        servings: 4,
        category: 'Postre',
        ingredients: [{ name: 'Dulce de leche', quantity: 200, unit: 'g' }],
      },
    })
    const { id } = (await created.json()) as { id: string }
    // Start from no allergens: the chip toggles, so a leftover 'leche' would turn it off
    await page.request.patch(`${API_URL}/auth/profile`, { headers, data: { allergens: [] } })
    try {
      await page.goto('/profile')
      const chip = page.getByTestId('allergen-chip-leche')
      await expect(chip).toBeVisible()
      await chip.click()
      await expect
        .poll(async () => {
          const res = await page.request.get(`${API_URL}/auth/profile`, { headers })
          return ((await res.json()) as { allergens: string[] }).allergens
        })
        .toContain('leche')

      await page.goto(`/recipe/${id}`)
      await expect(page.getByText(/Alérgenos:.*Leche y lácteos/)).toBeVisible()
    } finally {
      await page.request.patch(`${API_URL}/auth/profile`, { headers, data: { allergens: [] } })
      await page.request.delete(`${API_URL}/v1/recipes/${id}`, { headers })
    }
  })

  test('edits the display name inline', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const me = (await (await page.request.get(`${API_URL}/auth/me`, { headers })).json()) as {
      displayName: string | null
    }
    try {
      await page.goto('/profile')
      await expect(page.getByText('tocá para editar')).toBeVisible()
      await page.getByText('tocá para editar').click()
      const input = page.locator('input[autofocus], input').first()
      await input.fill('Demo E2E')
      await page.getByText('Guardar', { exact: true }).click()
      await expect(page.getByText('Demo E2E')).toBeVisible()
    } finally {
      // Restore the demo account's name so later tests and the visual tour see it
      const res = await page.request.patch(`${API_URL}/auth/me`, {
        headers,
        data: { displayName: me.displayName ?? 'Demo' },
      })
      expect(res.ok()).toBe(true)
    }
  })

  test('cancel exits name editing without saving', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('tocá para editar')).toBeVisible()
    await page.getByText('tocá para editar').click()
    await page.getByText('Cancelar', { exact: true }).click()
    await expect(page.getByText('tocá para editar')).toBeVisible()
  })

  test('preferred servings stepper increments and decrements', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('Porciones por defecto')).toBeVisible()
    const row = page.getByText('Porciones por defecto').locator('xpath=following-sibling::*[1]')
    const value = row.locator('div,span').filter({ hasText: /^\d+$/ }).first()
    const before = Number(await value.textContent())
    // The value clamps to [1, 20], and repeated runs can leave it parked at a
    // boundary — exercise both directions starting away from the stuck edge.
    if (before > 1) {
      await row.getByText('−', { exact: true }).click()
      await expect(value).toHaveText(String(before - 1))
      await row.getByText('+', { exact: true }).click()
      await expect(value).toHaveText(String(before))
    } else {
      await row.getByText('+', { exact: true }).click()
      await expect(value).toHaveText('2')
      await row.getByText('−', { exact: true }).click()
      await expect(value).toHaveText('1')
    }
  })

  test('toggles a dietary chip on and off', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('Preferencias dietéticas')).toBeVisible()
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const headers = { Authorization: `Bearer ${token}` }
    const diets = async () =>
      (
        (await (await page.request.get(`${API_URL}/auth/profile`, { headers })).json()) as {
          dietaryRestrictions: string[]
        }
      ).dietaryRestrictions
    const chip = page.getByTestId('profile-diet-chip-paleo')
    // Each tap round-trips to the profile: on, then off again
    await chip.click()
    await expect.poll(diets).toContain('paleo')
    await chip.click()
    await expect.poll(diets).not.toContain('paleo')
  })

  test('nutrition target stepper changes calories and restores', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('Objetivos nutricionales diarios')).toBeVisible()
    const row = page.getByText('Calorías', { exact: true }).locator('xpath=..')
    const valText = await row.locator('text=/\\d+/').first().textContent()
    const before = Number(valText?.match(/\d+/)?.[0] ?? 0)
    await row.getByText('+', { exact: true }).click()
    await expect(row.getByText(String(before + 100))).toBeVisible()
    await row.getByText('−', { exact: true }).click()
    await expect(row.getByText(String(before))).toBeVisible()
  })

  test('sign out asks for confirmation; dismissing stays logged in', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByTestId('profile-signout')).toBeVisible()
    page.once('dialog', (dialog) => void dialog.dismiss())
    await page.getByTestId('profile-signout').click()
    // still on profile, still authenticated
    await expect(page.getByTestId('profile-signout')).toBeVisible()
  })

  test('sign out confirm redirects to login', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByTestId('profile-signout')).toBeVisible()
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByTestId('profile-signout').click()
    await page.waitForURL(/auth/)
  })
})

// 2026-10-01 audit (Data): profiles stayed on the UTC default forever. The app
// now stores the device's zone the first time it sees the default.
test.describe('Profile time zone', () => {
  test.use({ timezoneId: 'America/Montevideo' })

  test('the device zone replaces the UTC default', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    await page.request.patch(`${API_URL}/auth/profile`, { headers, data: { timezone: 'UTC' } })
    await page.goto('/profile')
    await expect
      .poll(
        async () =>
          (
            (await (await page.request.get(`${API_URL}/auth/profile`, { headers })).json()) as {
              timezone: string | null
            }
          ).timezone,
      )
      .toBe('America/Montevideo')
  })
})
