import { testUnauth as test, expect } from './fixtures'
import { DEMO_ACCOUNTS } from './demoAccounts'
import { API_URL } from './env'
const E2E_EMAIL = DEMO_ACCOUNTS[0]!.email
const E2E_PASSWORD = DEMO_ACCOUNTS[0]!.password

/**
 * Auth E2E flows — unauthenticated screens (login, register, forgot).
 */

test.describe('Auth: login via form', () => {
  test('shows login screen when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/auth\/login/)
    await expect(page.getByText('Recetario').first()).toBeVisible()
    await expect(page.getByText('Ingresá a tu cuenta')).toBeVisible()
  })

  // Regression test for the 2026-07-03 audit finding: the auth guard used to
  // live only in index.tsx, so deep-linking straight to a protected screen
  // while unauthenticated skipped the redirect entirely. Now it's centralized
  // in _layout.tsx and applies to every route outside /auth/*.
  test('deep-linking to a protected screen while unauthenticated redirects to login', async ({
    page,
  }) => {
    await page.goto('/household')
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByPlaceholder('Email').fill('wrong@example.com')
    await page.getByPlaceholder('Contraseña').fill('wrongpass')
    await page.getByTestId('auth-login-submit').click()
    await expect(page.getByText(/Email o contraseña incorrectos|Error al conectar/)).toBeVisible()
  })

  test('shows validation error for empty email/password', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByTestId('auth-login-submit').click()
    await expect(page.getByText(/El email y la contraseña son obligatorios/)).toBeVisible()
  })

  test('logs in with valid credentials and redirects to home', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByPlaceholder('Email').fill(E2E_EMAIL)
    await page.getByPlaceholder('Contraseña').fill(E2E_PASSWORD)
    await page.getByTestId('auth-login-submit').click()

    await expect(page.getByText('Recetario').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('+ Nueva Receta')).toBeVisible()
  })

  test('register link navigates to register screen', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByText('Registrate')).toBeVisible()
    await page.getByText('Registrate').click()
    await expect(page.getByText('Crear cuenta').first()).toBeVisible()
  })

  test('forgot password link navigates to forgot screen', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByText('¿Olvidaste tu contraseña?').click()
    await expect(page.getByText('Restablecer contraseña')).toBeVisible()
  })
})

test.describe('Auth: forgot password', () => {
  // No email provider yet: the screen must not promise an email (D-2026-09-30-11).
  test('explains the admin reset instead of promising an email', async ({ page }) => {
    await page.goto('/auth/forgot')
    await expect(page.getByText('Restablecer contraseña')).toBeVisible()
    await expect(page.getByTestId('forgot-explainer')).toContainText('Todavía no enviamos emails')
    await expect(page.getByPlaceholder('vos@ejemplo.com')).toHaveCount(0)
    await expect(page.getByText(/Revisá tu email|Enviar link/)).toHaveCount(0)
  })

  test('back to sign in returns to login', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByText('¿Olvidaste tu contraseña?').click()
    await expect(page.getByTestId('forgot-explainer')).toBeVisible()
    await page.getByTestId('forgot-back').click()
    await expect(page).toHaveURL(/auth\/login/)
  })
})

test.describe('Auth: register', () => {
  const uniqueEmail = `e2e+${Date.now()}@recetario.app`

  test('shows validation errors for empty form', async ({ page }) => {
    await page.goto('/auth/register')
    await page.getByTestId('auth-register-submit').click()
    await expect(page.getByText(/El email y la contraseña son obligatorios/)).toBeVisible()
  })

  test('shows error for short password', async ({ page }) => {
    await page.goto('/auth/register')
    await page.getByPlaceholder('vos@ejemplo.com').fill(`short+${Date.now()}@recetario.app`)
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('abc')
    await page.getByPlaceholder('Repetí la contraseña').fill('abc')
    await page.getByTestId('auth-register-submit').click()
    await expect(page.getByText(/La contraseña debe tener al menos 8 caracteres/)).toBeVisible()
  })

  test('shows error when passwords do not match', async ({ page }) => {
    await page.goto('/auth/register')
    await page.getByPlaceholder('vos@ejemplo.com').fill(uniqueEmail)
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('password1')
    await page.getByPlaceholder('Repetí la contraseña').fill('password2')
    await page.getByTestId('auth-register-submit').click()
    await expect(page.getByText(/Las contraseñas no coinciden/)).toBeVisible()
  })

  test('sign in link navigates to login screen', async ({ page }) => {
    await page.goto('/auth/register')
    await expect(page.getByText('Ingresá')).toBeVisible()
    await page.getByText('Ingresá').click()
    await expect(page.getByText('Ingresá a tu cuenta')).toBeVisible()
  })

  test('registers a new user and redirects to home', async ({ page }) => {
    await page.goto('/auth/register')
    await page.getByPlaceholder('Tu nombre').fill('E2E User')
    await page.getByPlaceholder('vos@ejemplo.com').fill(uniqueEmail)
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('test12345')
    await page.getByPlaceholder('Repetí la contraseña').fill('test12345')
    await page.getByTestId('auth-register-submit').click()
    await expect(
      page.getByText('+ Nueva Receta').or(page.getByText(/Este email ya está registrado/)),
    ).toBeVisible({ timeout: 15000 })
  })

  test('a brand-new account gets the welcome card and can open the library', async ({ page }) => {
    const email = `nuevo+${Date.now()}@recetario.app`
    await page.goto('/auth/register')
    await page.getByPlaceholder('vos@ejemplo.com').fill(email)
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('test12345')
    await page.getByPlaceholder('Repetí la contraseña').fill('test12345')
    await page.getByTestId('auth-register-submit').click()
    await expect(page.getByTestId('welcome-card')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('welcome-new-recipe')).toBeVisible()
    await expect(page.getByTestId('welcome-profile')).toBeVisible()
    await page.getByTestId('welcome-library').click()
    await expect(page).toHaveURL(/\/library/)
  })

  test('shows error when email already registered', async ({ page }) => {
    // Register once via API to guarantee the email exists
    const dupEmail = `dup+${Date.now()}@recetario.app`
    await page.request.post(`${API_URL}/auth/register`, {
      data: { email: dupEmail, password: 'test12345', displayName: 'Dup User' },
    })

    await page.goto('/auth/register')
    await page.getByPlaceholder('vos@ejemplo.com').fill(dupEmail)
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('test12345')
    await page.getByPlaceholder('Repetí la contraseña').fill('test12345')
    await page.getByTestId('auth-register-submit').click()
    await expect(page.getByText(/Este email ya está registrado/)).toBeVisible()
  })
})

// Regression for the 2026-07-09 owner report: an expired/invalid stored JWT
// left the app stranded on 'Error al cargar recetas' — AuthGuard only checks
// token presence, so nothing ever redirected. Any API 401 must now clear the
// session and land the user on the login screen.
test.describe('Auth: expired session', () => {
  test('a stale token redirects to login instead of stranding on error screens', async ({
    page,
  }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('auth_token', 'token-vencido-invalido'))
    await page.goto('/')
    await expect(page).toHaveURL(/auth\/login/, { timeout: 15000 })
    await expect(page.getByText('Ingresá a tu cuenta')).toBeVisible()
    // and the poisoned token is gone, so the next load goes straight to login
    const stored = await page.evaluate(() => localStorage.getItem('auth_token'))
    expect(stored).toBeNull()
  })
})

// Error/edge branches: login 401 and the forgot-password confirmation flow.
// (Duplicate-email registration is already covered above with the real
// placeholders.)
test.describe('Auth: error branches', () => {
  test('wrong password shows an error and stays on login', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByPlaceholder('Email').fill(E2E_EMAIL)
    await page.getByPlaceholder('Contraseña').fill('clave-incorrecta')
    await page.getByTestId('auth-login-submit').click()
    await expect(page.getByText(/incorrectos/i).first()).toBeVisible()
    await expect(page).toHaveURL(/auth\/login/)
  })
})
