import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMcpServer } from '../index.js'
import { registerImportTools, isSafeImportUrl } from './importRecipe.js'

function getToolHandler(server: ReturnType<typeof createMcpServer>, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<
    string,
    { handler: (...a: unknown[]) => unknown }
  >
  const tool = tools[name]
  if (!tool) throw new Error(`Tool "${name}" not registered`)
  return tool.handler
}

const recipeHtml = `<html><head><script type="application/ld+json">${JSON.stringify({
  '@type': 'Recipe',
  name: 'Guiso',
  recipeIngredient: ['lentejas'],
  recipeInstructions: [{ '@type': 'HowToStep', text: 'Cocinar.' }],
})}</script></head><body><p>rico</p></body></html>`

describe('isSafeImportUrl', () => {
  it('allows public https', () => {
    expect(isSafeImportUrl('https://cookpad.com/receta')).toBe(true)
  })
  it('rejects http, localhost, private and link-local hosts', () => {
    expect(isSafeImportUrl('http://cookpad.com')).toBe(false)
    expect(isSafeImportUrl('https://localhost/x')).toBe(false)
    expect(isSafeImportUrl('https://app.localhost/x')).toBe(false)
    expect(isSafeImportUrl('https://127.0.0.1/x')).toBe(false)
    expect(isSafeImportUrl('https://10.1.2.3/x')).toBe(false)
    expect(isSafeImportUrl('https://192.168.0.5/x')).toBe(false)
    expect(isSafeImportUrl('https://172.16.0.1/x')).toBe(false)
    expect(isSafeImportUrl('https://169.254.169.254/latest')).toBe(false)
    expect(isSafeImportUrl('https://[::1]/x')).toBe(false)
    expect(isSafeImportUrl('https://[fd00::1]/x')).toBe(false)
    expect(isSafeImportUrl('not a url')).toBe(false)
  })
  it('allows a public IP literal', () => {
    expect(isSafeImportUrl('https://8.8.8.8/x')).toBe(true)
    expect(isSafeImportUrl('https://172.15.0.1/x')).toBe(true) // just outside 172.16-31
  })
})

describe('fetchRecipePage tool', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('registers the tool', () => {
    const server = createMcpServer()
    registerImportTools(server)
    const registered = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools
    expect(registered['fetchRecipePage']).toBeDefined()
  })

  it('returns structured data parsed from JSON-LD', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode(recipeHtml).buffer),
      }),
    )
    const server = createMcpServer()
    registerImportTools(server)
    const handler = getToolHandler(server, 'fetchRecipePage')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await handler({ url: 'https://cookpad.com/r' }, {})) as any
    const body = JSON.parse(result.content[0].text)
    expect(body.structured.title).toBe('Guiso')
    expect(body.structured.ingredients).toEqual(['lentejas'])
    expect(body.sourceUrl).toBe('https://cookpad.com/r')
    expect(body.cleanedText).toContain('rico')
  })

  it('returns null structured + cleaned text when no markup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode('<html><body>solo texto</body></html>').buffer),
      }),
    )
    const server = createMcpServer()
    registerImportTools(server)
    const handler = getToolHandler(server, 'fetchRecipePage')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await handler({ url: 'https://x.com/r' }, {})) as any
    const body = JSON.parse(result.content[0].text)
    expect(body.structured).toBeNull()
    expect(body.cleanedText).toBe('solo texto')
  })

  it('refuses unsafe URLs before fetching', async () => {
    const server = createMcpServer()
    registerImportTools(server)
    const handler = getToolHandler(server, 'fetchRecipePage')
    await expect(handler({ url: 'https://192.168.0.1/x' }, {})).rejects.toThrow(/public https/)
  })

  it('throws on a non-ok response and on an oversized body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const server = createMcpServer()
    registerImportTools(server)
    const handler = getToolHandler(server, 'fetchRecipePage')
    await expect(handler({ url: 'https://x.com/r' }, {})).rejects.toThrow(/404/)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(2_000_001)),
      }),
    )
    const server2 = createMcpServer()
    registerImportTools(server2)
    const handler2 = getToolHandler(server2, 'fetchRecipePage')
    await expect(handler2({ url: 'https://x.com/r' }, {})).rejects.toThrow(/too large/)
  })
})
