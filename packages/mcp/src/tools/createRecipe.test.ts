import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMcpServer, createApiClient } from '../index.js'
import { registerCreateRecipe } from './createRecipe.js'

const validInput = {
  title: 'Pasta Bolognese',
  servings: 4,
  category: 'Cena' as const,
  ingredients: [
    { name: 'pasta', quantity: 200, unit: 'g' as const },
    { name: 'ground beef', quantity: 300, unit: 'g' as const },
  ],
}

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

describe('createRecipe tool', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers createRecipe tool on the server', () => {
    const server = createMcpServer()
    const api = createApiClient()
    registerCreateRecipe(server, api)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (server as any)._registeredTools as Record<string, unknown>
    expect(tools['createRecipe']).toBeDefined()
  })

  it('calls POST /v1/recipes with valid data', async () => {
    const mockRecipe = { id: 'abc123', ...validInput }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRecipe),
    })
    vi.stubGlobal('fetch', mockFetch)

    const server = createMcpServer()
    const api = createApiClient()
    registerCreateRecipe(server, api)

    const handler = getToolHandler(server, 'createRecipe')
    const rawResult = await handler(
      { ...validInput, steps: [{ text: 'Boil pasta' }], totalTimeMin: 30 },
      {},
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = rawResult as any

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/recipes')
    expect(opts.method).toBe('POST')

    expect(result.content[0].type).toBe('text')
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.recipe).toEqual(mockRecipe)
    expect(parsed.warnings).toBeUndefined()
  })

  it('includes warning when no steps are provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'xyz', ...validInput }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const server = createMcpServer()
    const api = createApiClient()
    registerCreateRecipe(server, api)

    const handler = getToolHandler(server, 'createRecipe')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await handler({ ...validInput }, {})) as any

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.warnings).toContain('No steps provided. Consider adding cooking steps.')
  })

  it('includes warning when no cooking time is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'xyz', ...validInput }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const server = createMcpServer()
    const api = createApiClient()
    registerCreateRecipe(server, api)

    const handler = getToolHandler(server, 'createRecipe')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await handler({ ...validInput }, {})) as any

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.warnings).toContain('No cooking time provided.')
  })

  it('returns isError: true with suggestions on API error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: 'Validation error' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const server = createMcpServer()
    const api = createApiClient()
    registerCreateRecipe(server, api)

    const handler = getToolHandler(server, 'createRecipe')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await handler({ ...validInput }, {})) as any

    expect(result.isError).toBe(true)
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.error).toBe('Failed to create recipe')
    expect(parsed.suggestions).toBeDefined()
    expect(Array.isArray(parsed.suggestions)).toBe(true)
  })
})

it('includes source when sourceUrl is provided', async () => {
  const mockRecipe = { id: 'src1', ...validInput }
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockRecipe),
  })
  vi.stubGlobal('fetch', mockFetch)

  const server = createMcpServer()
  const api = createApiClient()
  registerCreateRecipe(server, api)

  const handler = getToolHandler(server, 'createRecipe')
  await handler({ ...validInput, sourceUrl: 'https://ejemplo.com/receta', sourceType: 'url' }, {})

  const body = JSON.parse((mockFetch.mock.calls[0]?.[1] as { body: string }).body)
  expect(body.source).toEqual({
    type: 'url',
    url: 'https://ejemplo.com/receta',
    externalId: undefined,
  })
})

it('defaults source to mcp when no sourceUrl or sourceType', async () => {
  const mockRecipe = { id: 'src2', ...validInput }
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockRecipe),
  })
  vi.stubGlobal('fetch', mockFetch)

  const server = createMcpServer()
  const api = createApiClient()
  registerCreateRecipe(server, api)

  const handler = getToolHandler(server, 'createRecipe')
  await handler({ ...validInput }, {})

  const body = JSON.parse((mockFetch.mock.calls[0]?.[1] as { body: string }).body)
  expect(body.source).toEqual({ type: 'mcp' })
})

it('uses mcp as sourceType fallback when only sourceUrl is provided', async () => {
  const mockRecipe = { id: 'src3', ...validInput }
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockRecipe),
  })
  vi.stubGlobal('fetch', mockFetch)

  const server = createMcpServer()
  const api = createApiClient()
  registerCreateRecipe(server, api)

  const handler = getToolHandler(server, 'createRecipe')
  await handler({ ...validInput, sourceUrl: 'https://ejemplo.com' }, {})

  const body = JSON.parse((mockFetch.mock.calls[0]?.[1] as { body: string }).body)
  expect(body.source.type).toBe('mcp')
})

it('handles non-Error thrown (string error)', async () => {
  const mockFetch = vi.fn().mockRejectedValue('string error')
  vi.stubGlobal('fetch', mockFetch)

  const server = createMcpServer()
  const api = createApiClient()
  registerCreateRecipe(server, api)

  const handler = getToolHandler(server, 'createRecipe')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await handler({ ...validInput }, {})) as any
  expect(result.isError).toBe(true)
  const parsed = JSON.parse(result.content[0].text)
  expect(parsed.error).toBe('Failed to create recipe')
})
