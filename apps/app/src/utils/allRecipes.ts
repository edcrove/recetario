/** The API's largest page for GET /v1/recipes and GET /v1/library. */
export const RECIPES_PAGE = 100

/**
 * Every recipe a paged list endpoint returns, page by page. Home and the menu
 * picker used one page of 50 (the library one of 30), so past the first page
 * the oldest never showed (and client-side filters only looked at that page).
 */
export async function fetchAllRecipes<T>(
  list: (params: { limit: number; offset: number }) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = []
  for (;;) {
    const page = await list({ limit: RECIPES_PAGE, offset: all.length })
    all.push(...page)
    if (page.length < RECIPES_PAGE) return all
  }
}
