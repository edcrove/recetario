import { lookup } from 'node:dns/promises'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { parseRecipeFromHtml, htmlToText } from '@recetario/shared'

const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 10_000

/** True for IPv4 addresses that must never be fetched (non-public ranges). */
function isPrivateV4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return (
    a === 0 || // "this network" (0.0.0.0 reaches localhost on Linux)
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  )
}

/** IPv4 embedded in an IPv4-mapped IPv6 address (::ffff:7f00:1 or ::ffff:127.0.0.1). */
function mappedV4(ip: string): string | null {
  const m = /^(?:0{0,4}:){0,4}:?:ffff:(.+)$/.exec(ip)
  if (!m) return null
  const rest = m[1]!
  if (rest.includes('.')) return rest
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest)
  if (!hex) return null
  const hi = parseInt(hex[1]!, 16)
  const lo = parseInt(hex[2]!, 16)
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
}

/** True for any IP literal (v4 or v6) outside the public internet. */
export function isPrivateIp(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, '')
  if (isPrivateV4(ip)) return true
  if (!ip.includes(':')) return false
  const v4 = mappedV4(ip)
  if (v4) return isPrivateV4(v4)
  return (
    ip === '::' ||
    ip === '::1' ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    ip.startsWith('fe8') ||
    ip.startsWith('fe9') ||
    ip.startsWith('fea') ||
    ip.startsWith('feb') ||
    ip.startsWith('ff')
  )
}

/**
 * SSRF guard on the URL itself: only https, no localhost names, no
 * private/loopback/link-local/CGNAT/multicast IP literals (v4, v6, v4-mapped).
 * Hostnames are additionally resolved before each request (resolvesPublicly).
 */
export function isSafeImportUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  return !isPrivateIp(host)
}

/**
 * A name like 127.0.0.1.nip.io passes the literal check but resolves to a
 * private address: every address the host resolves to must be public.
 */
async function resolvesPublicly(raw: string): Promise<boolean> {
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, '')
  try {
    const addrs = await lookup(host, { all: true, verbatim: true })
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address))
  } catch {
    return false
  }
}

const MAX_REDIRECTS = 5

/** Fetches with redirects followed by hand, re-validating every hop. */
async function safeFetch(url: string, signal: AbortSignal): Promise<Response> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeImportUrl(current) || !(await resolvesPublicly(current))) {
      throw new Error('Refusing to fetch: only public https URLs are allowed')
    }
    const res = await fetch(current, {
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': 'RecetarioBot/1.0', Accept: 'text/html' },
    })
    const location = res.status >= 300 && res.status < 400 ? res.headers?.get('location') : null
    if (!location) return res
    current = new URL(location, current).toString()
  }
  throw new Error('Too many redirects')
}

// No api client: fetchRecipePage only reaches external pages and hands the
// parsed result back to the agent, which drafts a separate createRecipe call.
export function registerImportTools(server: McpServer) {
  server.tool(
    'fetchRecipePage',
    "Fetch a recipe web page and extract its data. Returns { structured, cleanedText, sourceUrl }: 'structured' is the recipe parsed deterministically from the page's schema.org/JSON-LD markup (title, ingredients, steps, times, servings, nutrition) when present — prefer it. When the page has no markup, 'structured' is null and you read 'cleanedText' (the page's visible text) to extract the recipe yourself. Then call createRecipe with sourceUrl set to preserve provenance. Only fetches public https URLs.",
    { url: z.string().url().describe('Public https URL of the recipe page') },
    async ({ url }) => {
      if (!isSafeImportUrl(url)) {
        throw new Error('Refusing to fetch: only public https URLs are allowed')
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      let html: string
      try {
        const res = await safeFetch(url, controller.signal)
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
        // Guard against huge bodies: read at most MAX_BYTES
        const buf = await res.arrayBuffer()
        if (buf.byteLength > MAX_BYTES) throw new Error('Page too large')
        html = new TextDecoder().decode(buf)
      } finally {
        clearTimeout(timer)
      }

      const structured = parseRecipeFromHtml(html)
      const cleanedText = htmlToText(html).slice(0, 20_000)

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ structured, cleanedText, sourceUrl: url }, null, 2),
          },
        ],
      }
    },
  )
}
