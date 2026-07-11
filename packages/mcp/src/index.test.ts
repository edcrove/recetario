import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMcpServer, createApiClient, registerAllTools } from './index.js'

const EXPECTED_TOOLS = [
  'createRecipe',
  'getRecipe',
  'searchRecipes',
  'listRecipes',
  'updateRecipe',
  'deleteRecipe',
  'addToMenu',
  'removeFromMenu',
  'getMenu',
  'generateShoppingList',
  'whoami',
  'updateProfile',
  'listHouseholdMembers',
  'logCookSession',
  'getCookHistory',
  'getMostCooked',
  'getFoodTypes',
  'createCollection',
  'listCollections',
  'addToCollection',
  'addRecipeRelation',
  'getRelatedRecipes',
  'listTaxonomy',
  'renameTaxonomyItem',
  'mergeTags',
  'getTaxonomyUsage',
  'getMacros',
  'browseLibrary',
  'copyRecipe',
  'setNutritionGoals',
  'getDayNutrition',
  'fetchRecipePage',
  'listUnmatchedIngredients',
  'createCanonicalIngredient',
  'setIngredientSynonym',
  'update_pantry',
  'what_can_i_cook',
  'suggest_from_ingredients',
  'get_menu_missing_ingredients',
]

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('MCP server', () => {
  it('creates server with correct name', () => {
    const server = createMcpServer()
    expect(server).toBeDefined()
  })

  it('createApiClient returns an object with request method', () => {
    const client = createApiClient()
    expect(typeof client.request).toBe('function')
  })
})

describe('registerAllTools (main bootstrap)', () => {
  it('registers all expected tools', async () => {
    const server = createMcpServer()
    const apiClient = createApiClient()
    const spy = vi.spyOn(server, 'tool')

    await registerAllTools(server, apiClient)

    const registeredNames = spy.mock.calls.map((call) => call[0] as string)
    expect(registeredNames.sort()).toEqual(EXPECTED_TOOLS.sort())
  })

  it('registers exactly 39 tools — no duplicates, no missing', async () => {
    const server = createMcpServer()
    const apiClient = createApiClient()
    const spy = vi.spyOn(server, 'tool')

    await registerAllTools(server, apiClient)

    expect(spy).toHaveBeenCalledTimes(39)
  })
})

describe('createApiClient.request', () => {
  it('throws with status and body on non-ok response', async () => {
    // 400, not 422: the real API (Hono + @hono/zod-openapi) always returns
    // 400 for validation errors, never 422 — this must match the real
    // contract, not an arbitrary non-2xx example.
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Validation failed' }),
    })

    const client = createApiClient()
    const err = await client.request('/v1/recipes').catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toContain('API error 400')
    expect(err.message).toContain('Validation failed')
  })

  it('throws with empty body when json parsing fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('invalid json')
      },
    })

    const client = createApiClient()
    await expect(client.request('/v1/recipes')).rejects.toThrow('API error 500')
  })

  it('returns parsed json on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123', title: 'Test' }),
    })

    const client = createApiClient()
    const result = await client.request('/v1/recipes')
    expect(result).toEqual({ id: '123', title: 'Test' })
  })
})
