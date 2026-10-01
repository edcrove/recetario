import { expect, type Page } from '@playwright/test'
import { API_URL } from './env'

/**
 * Shared API helpers for E2E setup/cleanup, so specs stop re-declaring their
 * own copies (2026-10-01 audit). Everything uses the signed-in demo account's
 * JWT from localStorage, the same session the UI under test uses.
 */

export async function authHeaders(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'))
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/** Creates a minimal recipe owned by the signed-in account; fails the test if it can't. */
export async function createRecipeViaApi(page: Page, overrides: Record<string, unknown> = {}) {
  const res = await page.request.post(`${API_URL}/v1/recipes`, {
    headers: await authHeaders(page),
    data: {
      title: `E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      servings: 2,
      category: 'Cena',
      ingredients: [{ name: 'agua', quantity: 1, unit: 'l' }],
      steps: [{ text: 'Paso único.' }],
      ...overrides,
    },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()) as { id: string; title: string }
}

/** Cleanup: deletes the recipe; a 404 (already gone) is fine, anything else fails. */
export async function deleteRecipeViaApi(page: Page, id: string) {
  const res = await page.request.delete(`${API_URL}/v1/recipes/${id}`, {
    headers: await authHeaders(page),
  })
  expect([204, 404]).toContain(res.status())
}
