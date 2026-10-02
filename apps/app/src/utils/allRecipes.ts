import type { Recipe } from '@recetario/shared'

/** The API's largest page for GET /v1/recipes. */
export const RECIPES_PAGE = 100

/**
 * Every recipe the caller can see, page by page. Home and the menu picker used
 * one page of 50, so from the 51st recipe on the oldest ones never showed
 * (and the time/difficulty filters only looked at those 50).
 */
export async function fetchAllRecipes(
  list: (params: { limit: number; offset: number }) => Promise<Recipe[]>,
): Promise<Recipe[]> {
  const all: Recipe[] = []
  for (;;) {
    const page = await list({ limit: RECIPES_PAGE, offset: all.length })
    all.push(...page)
    if (page.length < RECIPES_PAGE) return all
  }
}
