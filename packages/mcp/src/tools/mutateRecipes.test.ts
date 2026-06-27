import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMcpServer, createApiClient } from '../index.js'
import { registerMutationTools } from './mutateRecipes.js'

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

const TEST_ID = 'e7a5b3c1-1234-5678-9abc-def012345678'

describe('mutation tools', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers updateRecipe and deleteRecipe', () => {
    const server = createMcpServer()
    const api = createApiClient()
    registerMutationTools(server, api)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (server as any)._registeredTools as Record<string, unknown>
    expect(tools['updateRecipe']).toBeDefined()
    expect(tools['deleteRecipe']).toBeDefined()
  })

  describe('updateRecipe', () => {
    it('calls PUT /v1/recipes/:id with updates', async () => {
      const updatedRecipe = { id: TEST_ID, title: 'Updated Title', servings: 6 }
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedRecipe),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      const api = createApiClient()
      registerMutationTools(server, api)

      const handler = getToolHandler(server, 'updateRecipe')

      const result = (await handler(
        { id: TEST_ID, title: 'Updated Title', servings: 6 },
        {},
      )) as any

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain(`/v1/recipes/${TEST_ID}`)
      expect(opts.method).toBe('PUT')

      const body = JSON.parse(opts.body as string)
      expect(body.title).toBe('Updated Title')
      expect(body.servings).toBe(6)
      // id should not be in body
      expect(body.id).toBeUndefined()

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual(updatedRecipe)
    })
  })

  describe('deleteRecipe', () => {
    it('calls DELETE /v1/recipes/:id and returns deleted: true', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      })
      vi.stubGlobal('fetch', mockFetch)

      const server = createMcpServer()
      const api = createApiClient()
      registerMutationTools(server, api)

      const handler = getToolHandler(server, 'deleteRecipe')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await handler({ id: TEST_ID }, {})) as any

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain(`/v1/recipes/${TEST_ID}`)
      expect(opts.method).toBe('DELETE')

      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.deleted).toBe(true)
      expect(parsed.id).toBe(TEST_ID)
    })
  })
})
