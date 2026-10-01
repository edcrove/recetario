import { expect, type Page } from '@playwright/test'

/** Seeded on every demo account (src/scripts/demo-recipes-data.ts). */
export const SEEDED_RECIPE = 'Milanesa de pollo napolitana'

/**
 * Opens a seeded recipe through the home search: recipes created by other specs
 * land at the top of the list and can push the seeded ones out of view.
 */
export async function openSeededRecipe(page: Page, title = SEEDED_RECIPE) {
  await page.getByPlaceholder(/buscar recetas/i).fill(title)
  await page.getByText(title).first().click()
  await expect(page.getByTestId('recipe-detail-cook')).toBeVisible({ timeout: 20000 })
}
