import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: mockLookup }))

import { createMcpServer } from '../index.js'
import { registerImportTools, isSafeImportUrl, isPrivateIp } from './importRecipe.js'

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

describe('isPrivateIp', () => {
  it('flags non-public IPv4 ranges', () => {
    for (const ip of [
      '0.0.0.0',
      '10.1.2.3',
      '127.0.0.1',
      '100.64.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.1',
      '192.0.0.8',
      '198.18.0.1',
      '224.0.0.1',
    ])
      expect(isPrivateIp(ip)).toBe(true)
    expect(isPrivateIp('93.184.216.34')).toBe(false)
    expect(isPrivateIp('100.128.0.1')).toBe(false)
    expect(isPrivateIp('100.63.0.1')).toBe(false)
    expect(isPrivateIp('172.32.0.1')).toBe(false)
    expect(isPrivateIp('198.20.0.1')).toBe(false)
    expect(isPrivateIp('192.169.0.1')).toBe(false)
    expect(isPrivateIp('169.253.0.1')).toBe(false)
  })

  it('flags IPv6 loopback, unspecified, ULA, link-local, multicast and v4-mapped privates', () => {
    for (const ip of [
      '::',
      '::1',
      'fd00::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '[::ffff:7f00:1]',
      '::ffff:a9fe:a9fe',
    ])
      expect(isPrivateIp(ip)).toBe(true)
    expect(isPrivateIp('2606:4700::1111')).toBe(false)
    expect(isPrivateIp('::ffff:5db8:d822')).toBe(false)
    expect(isPrivateIp('::ffff:zz')).toBe(false)
  })
})

describe('fetchRecipePage tool', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    mockLookup.mockReset().mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  })
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

  it('refuses a public-looking name that resolves to a private address (DNS rebinding)', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    const server = createMcpServer()
    registerImportTools(server)
    const handler = getToolHandler(server, 'fetchRecipePage')
    await expect(handler({ url: 'https://127.0.0.1.nip.io/x' }, {})).rejects.toThrow(/public https/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refuses when the name does not resolve', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'))
    const server = createMcpServer()
    registerImportTools(server)
    const handler = getToolHandler(server, 'fetchRecipePage')
    await expect(handler({ url: 'https://nope.invalid/x' }, {})).rejects.toThrow(/public https/)
  })

  it('follows redirects by hand and refuses one that points inside', async () => {
    const redirect = (to: string) => ({
      ok: false,
      status: 302,
      headers: new Headers({ location: to }),
    })
    const page = {
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(recipeHtml).buffer),
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(redirect('/r2')).mockResolvedValueOnce(page),
    )
    const server = createMcpServer()
    registerImportTools(server)
    const handler = getToolHandler(server, 'fetchRecipePage')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = (await handler({ url: 'https://cookpad.com/r' }, {})) as any
    expect(JSON.parse(ok.content[0].text).structured.title).toBe('Guiso')
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe('https://cookpad.com/r2')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(redirect('https://169.254.169.254/latest')))
    await expect(handler({ url: 'https://cookpad.com/r' }, {})).rejects.toThrow(/public https/)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(redirect('/again')))
    await expect(handler({ url: 'https://cookpad.com/r' }, {})).rejects.toThrow(
      /Too many redirects/,
    )
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

  it('aborts the fetch when it exceeds the timeout', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: string, init: { signal: AbortSignal }) =>
            new Promise((_, reject) => {
              init.signal.addEventListener('abort', () => reject(new Error('aborted')))
            }),
        ),
      )
      const server = createMcpServer()
      registerImportTools(server)
      const handler = getToolHandler(server, 'fetchRecipePage')
      const pending = expect(handler({ url: 'https://x.com/r' }, {})).rejects.toThrow(/aborted/)
      await vi.runAllTimersAsync()
      await pending
    } finally {
      vi.useRealTimers()
    }
  })
})
