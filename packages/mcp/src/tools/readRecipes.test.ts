import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMcpServer, createApiClient } from '../index.js'
import { registerReadTools } from './readRecipes.js'

function getToolHandler(server: ReturnType<typeof createMcpServer>, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<
    string,
    { handler: (...args: unknown[]) => unknown }
  >
  const tool = tools[name]
  if (!tool) throw new Error(`Tool "${name}" not registered`)
  return tool.handler
}

describe('read tools', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers getRecipe, searchRecipes, listRecipes', () => {
    const server = createMcpServer()
    const api = createApiClient()
    registerReadTools(server, api)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (server as any)._registeredTools as Record<string, unknown>
    expect(tools['getRecipe']).toBeDefined()
    expect(tools['searchRecipes']).toBeDefined()
    expect(tools['listRecipes']).toBeDefined()
  })

  describe('getRecipe', () => {
    it('calls GET /v1/recipes/:id', async () => {
      const mockRecipe = { id: 'e7a5b3c1-1234-5678-9abc-def012345678', title: 'Test' }
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRecipe),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      const api = createApiClient()
      registerReadTools(server, api)

      const handler = getToolHandler(server, 'getRecipe')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await handler({ id: 'e7a5b3c1-1234-5678-9abc-def012345678' }, {})) as any

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/v1/recipes/e7a5b3c1-1234-5678-9abc-def012345678')

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual(mockRecipe)
    })
  })

  describe('searchRecipes', () => {
    it('calls GET /v1/recipes/search with query params', async () => {
      const mockResults = [{ id: '1', title: 'Pasta' }]
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResults),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      const api = createApiClient()
      registerReadTools(server, api)

      const handler = getToolHandler(server, 'searchRecipes')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await handler({ q: 'pasta', category: 'Cena' }, {})) as any

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/v1/recipes/search')
      expect(url).toContain('q=pasta')
      expect(url).toContain('category=Cena')

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual(mockResults)
    })

    it('calls GET /v1/recipes/search without params when none provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      const api = createApiClient()
      registerReadTools(server, api)

      const handler = getToolHandler(server, 'searchRecipes')
      await handler({}, {})

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/v1/recipes/search')
    })
  })

  describe('listRecipes', () => {
    it('calls GET /v1/recipes with limit and offset', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      const api = createApiClient()
      registerReadTools(server, api)

      const handler = getToolHandler(server, 'listRecipes')
      await handler({ limit: 10, offset: 20 }, {})

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/v1/recipes?limit=10&offset=20')
    })
  })
})
