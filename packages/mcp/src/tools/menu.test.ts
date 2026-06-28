import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMcpServer, createApiClient } from '../index.js'
import { registerMenuTools } from './menu.js'

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

const mockEntry = {
  id: 'e7a5b3c1-1234-5678-9abc-def012345678',
  date: '2026-07-07',
  slot: 'Cena',
  recipeId: 'a1b2c3d4-1234-5678-9abc-def012345678',
  servings: 4,
}

describe('menu tools', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers addToMenu, removeFromMenu, getMenu, generateShoppingList', () => {
    const server = createMcpServer()
    registerMenuTools(server, createApiClient())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (server as any)._registeredTools as Record<string, unknown>
    expect(tools['addToMenu']).toBeDefined()
    expect(tools['removeFromMenu']).toBeDefined()
    expect(tools['getMenu']).toBeDefined()
    expect(tools['generateShoppingList']).toBeDefined()
  })

  describe('addToMenu', () => {
    it('calls POST /v1/menu with correct body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEntry),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      registerMenuTools(server, createApiClient())

      const handler = getToolHandler(server, 'addToMenu')

      const result = (await handler(
        {
          date: '2026-07-07',
          slot: 'Cena',
          recipeId: 'a1b2c3d4-1234-5678-9abc-def012345678',
          servings: 4,
        },
        {},
      )) as any

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/v1/menu')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body as string)
      expect(body.slot).toBe('Cena')
      expect(body.servings).toBe(4)

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.slot).toBe('Cena')
    })
  })

  describe('removeFromMenu', () => {
    it('calls DELETE /v1/menu/:date/:slot', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      registerMenuTools(server, createApiClient())

      const handler = getToolHandler(server, 'removeFromMenu')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await handler({ date: '2026-07-07', slot: 'Cena' }, {})) as any

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/v1/menu/2026-07-07/')
      expect(url).toContain('Cena')
      expect(opts.method).toBe('DELETE')
      expect(result.content[0].text).toContain('Removed')
    })

    it('encodes slot with slashes (Snacks/Otros)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      registerMenuTools(server, createApiClient())

      const handler = getToolHandler(server, 'removeFromMenu')
      await handler({ date: '2026-07-07', slot: 'Snacks/Otros' }, {})

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('Snacks%2FOtros')
    })
  })

  describe('getMenu', () => {
    it('calls GET /v1/menu?weekStart=', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([mockEntry]),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      registerMenuTools(server, createApiClient())

      const handler = getToolHandler(server, 'getMenu')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await handler({ weekStart: '2026-07-07' }, {})) as any

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/v1/menu?weekStart=2026-07-07')
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toHaveLength(1)
    })
  })

  describe('generateShoppingList', () => {
    it('calls GET /v1/menu/shopping-list?weekStart=', async () => {
      const mockList = [{ ingredient: 'pasta', quantity: 200, unit: 'g' }]
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockList),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      registerMenuTools(server, createApiClient())

      const handler = getToolHandler(server, 'generateShoppingList')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await handler({ weekStart: '2026-07-07' }, {})) as any

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/v1/menu/shopping-list?weekStart=2026-07-07')
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed[0].ingredient).toBe('pasta')
    })
  })
})
