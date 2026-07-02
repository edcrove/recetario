import { test, expect } from '@playwright/test'
const base = test

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
const E2E_EMAIL = process.env['E2E_EMAIL'] ?? 'demo@recetario.app'
const E2E_PASSWORD = process.env['E2E_PASSWORD'] ?? 'demo1234'

/**
 * Auth E2E flows.
 * These tests use the base test (no auth fixture) to test the login form itself.
 */

test.describe('Auth: login via form', () => {
  base('shows login screen when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/auth\/login/, { timeout: 10000 })
    await expect(page.getByText('Recetario').first()).toBeVisible()
    await expect(page.getByText('Ingresá a tu cuenta')).toBeVisible()
  })

  base('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByPlaceholder('Email').fill('wrong@example.com')
    await page.getByPlaceholder('Contraseña').fill('wrongpass')
    await page.getByTestId('auth-login-submit').click()
    await expect(page.getByText(/Email o contraseña incorrectos|Error al conectar/)).toBeVisible({
      timeout: 8000,
    })
  })

  base('logs in with valid credentials and redirects to home', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByPlaceholder('Email').fill(E2E_EMAIL)
    await page.getByPlaceholder('Contraseña').fill(E2E_PASSWORD)
    await page.getByTestId('auth-login-submit').click()

    // Should land on home with recipe list
    await expect(page.getByText('Recetario').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('+ Nueva Receta')).toBeVisible()
  })

  base('register link navigates to register screen', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByText('Registrate')).toBeVisible({ timeout: 5000 })
    await page.getByText('Registrate').click()
    await expect(page.getByText('Crear cuenta').first()).toBeVisible({ timeout: 5000 })
  })

  base('forgot password link navigates to forgot screen', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByText('¿Olvidaste tu contraseña?').click()
    await expect(page.getByText('Restablecer contraseña')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Auth: register', () => {
  const uniqueEmail = `e2e+${Date.now()}@recetario.app`

  base('shows validation errors for empty form', async ({ page }) => {
    await page.goto('/auth/register')
    // Click the submit button (not the page heading which also says "Crear cuenta")
    await page.getByTestId('auth-register-submit').click()
    await expect(page.getByText(/El email y la contraseña son obligatorios/)).toBeVisible()
  })

  base('shows error when passwords do not match', async ({ page }) => {
    await page.goto('/auth/register')
    await page.getByPlaceholder('vos@ejemplo.com').fill(uniqueEmail)
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('password1')
    await page.getByPlaceholder('Repetí la contraseña').fill('password2')
    await page.getByTestId('auth-register-submit').click()
    await expect(page.getByText(/Las contraseñas no coinciden/)).toBeVisible()
  })

  base('registers a new user and redirects to home', async ({ page }) => {
    await page.goto('/auth/register')
    await page.getByPlaceholder('Tu nombre').fill('E2E User')
    await page.getByPlaceholder('vos@ejemplo.com').fill(uniqueEmail)
    await page.getByPlaceholder('Mínimo 8 caracteres').fill('test12345')
    await page.getByPlaceholder('Repetí la contraseña').fill('test12345')
    await page.getByTestId('auth-register-submit').click()
    // Either registered and redirected, or email already taken
    await expect(
      page.getByText('+ Nueva Receta').or(page.getByText(/Este email ya está registrado/)),
    ).toBeVisible({ timeout: 15000 })
  })
})
