import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMcpServer, createApiClient } from '../index.js'
import { registerLibraryTools } from './library.js'

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

describe('library tools', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers browseLibrary and copyRecipe', () => {
    const server = createMcpServer()
    const api = createApiClient()
    registerLibraryTools(server, api)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (server as any)._registeredTools as Record<string, unknown>
    expect(tools['browseLibrary']).toBeDefined()
    expect(tools['copyRecipe']).toBeDefined()
  })

  describe('browseLibrary', () => {
    it('calls GET /v1/library with defaults', async () => {
      const mockList = [{ id: 'r1', title: 'Guiso', author: 'Ana' }]
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockList),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      registerLibraryTools(server, createApiClient())
      const handler = getToolHandler(server, 'browseLibrary')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await handler({ limit: 30, offset: 0 }, {})) as any

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('/v1/library?')
      expect(url).toContain('limit=30')
      expect(url).toContain('offset=0')
      expect(url).not.toContain('search=')
      expect(JSON.parse(result.content[0].text)).toEqual(mockList)
    })

    it('passes the search filter through', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      registerLibraryTools(server, createApiClient())
      const handler = getToolHandler(server, 'browseLibrary')
      await handler({ search: 'guiso', limit: 5, offset: 10 }, {})

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('search=guiso')
      expect(url).toContain('limit=5')
      expect(url).toContain('offset=10')
    })
  })

  describe('copyRecipe', () => {
    it('POSTs to /v1/recipes/:id/copy and returns the fork', async () => {
      const fork = { id: 'f1', forkedFromId: 'e7a5b3c1-1234-5678-9abc-def012345678' }
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fork),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      registerLibraryTools(server, createApiClient())
      const handler = getToolHandler(server, 'copyRecipe')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await handler({ id: 'e7a5b3c1-1234-5678-9abc-def012345678' }, {})) as any

      const [url, options] = mockFetch.mock.calls[0] as [string, { method: string }]
      expect(url).toContain('/v1/recipes/e7a5b3c1-1234-5678-9abc-def012345678/copy')
      expect(options.method).toBe('POST')
      expect(JSON.parse(result.content[0].text)).toEqual(fork)
    })

    it('propagates a 404 for unreadable recipes', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Recipe not found' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      registerLibraryTools(server, createApiClient())
      const handler = getToolHandler(server, 'copyRecipe')

      await expect(handler({ id: 'e7a5b3c1-1234-5678-9abc-def012345678' }, {})).rejects.toThrow(
        /404/,
      )
    })
  })
})
