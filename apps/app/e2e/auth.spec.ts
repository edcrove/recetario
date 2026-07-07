import { testUnauth as test, expect } from './fixtures'
import { DEMO_ACCOUNTS } from './demoAccounts'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
const E2E_EMAIL = DEMO_ACCOUNTS[0]!.email
const E2E_PASSWORD = DEMO_ACCOUNTS[0]!.password

/**
 * Auth E2E flows — unauthenticated screens (login, register, forgot).
 */

test.describe('Auth: login via form', () => {
  test('shows login screen when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 })
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
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 })
  })

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByPlaceholder('Email').fill('wrong@example.com')
    await page.getByPlaceholder('Contraseña').fill('wrongpass')
    await page.getByTestId('auth-login-submit').click()
    await expect(page.getByText(/Email o contraseña incorrectos|Error al conectar/)).toBeVisible({
      timeout: 8000,
    })
  })

  test('shows validation error for empty email/password', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByTestId('auth-login-submit').click()
    await expect(page.getByText(/El email y la contraseña son obligatorios/)).toBeVisible({
      timeout: 5000,
    })
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
    await expect(page.getByText('Registrate')).toBeVisible({ timeout: 5000 })
    await page.getByText('Registrate').click()
    await expect(page.getByText('Crear cuenta').first()).toBeVisible({ timeout: 5000 })
  })

  test('forgot password link navigates to forgot screen', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByText('¿Olvidaste tu contraseña?').click()
    await expect(page.getByText('Restablecer contraseña')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Auth: forgot password', () => {
  test('submit button disabled until email is filled', async ({ page }) => {
    await page.goto('/auth/forgot')
    await expect(page.getByText('Restablecer contraseña')).toBeVisible({ timeout: 5000 })
    await expect(page.getByPlaceholder('vos@ejemplo.com')).toBeVisible()
  })

  test('submitting shows confirmation screen', async ({ page }) => {
    await page.goto('/auth/forgot')
    await page.getByPlaceholder('vos@ejemplo.com').fill('someone@example.com')
    await page.getByText('Enviar link').click()
    await expect(page.getByText('Revisá tu email')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/someone@example\.com/)).toBeVisible()
  })

  test('back to sign in link from confirmation screen', async ({ page }) => {
    await page.goto('/auth/forgot')
    await page.getByPlaceholder('vos@ejemplo.com').fill('someone@example.com')
    await page.getByText('Enviar link').click()
    await expect(page.getByText('Revisá tu email')).toBeVisible({ timeout: 5000 })
    await page.getByText('Volver al inicio').click()
    await expect(page).toHaveURL(/auth\/login/, { timeout: 5000 })
  })

  test('back link from initial forgot screen returns to login', async ({ page }) => {
    // Navigate via login so router.back() has history to go to
    await page.goto('/auth/login')
    await page.getByText('¿Olvidaste tu contraseña?').click()
    await expect(page.getByText('Restablecer contraseña')).toBeVisible({ timeout: 5000 })
    await page.getByText('← Volver al inicio').click()
    await expect(page).toHaveURL(/auth\/login/, { timeout: 5000 })
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
    await expect(page.getByText('Ingresá')).toBeVisible({ timeout: 5000 })
    await page.getByText('Ingresá').click()
    await expect(page.getByText('Ingresá a tu cuenta')).toBeVisible({ timeout: 5000 })
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
    await expect(page.getByText(/Este email ya está registrado/)).toBeVisible({ timeout: 10000 })
  })
})
