import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createApiClient } from '../index.js'
import { parseRecipeFromHtml, htmlToText } from '@recetario/shared'

const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 10_000

/**
 * SSRF guard: only fetch public https URLs. Rejects non-https, localhost, and
 * RFC 1918 / link-local / unique-local IP literals so the tool can't be used
 * to reach the local network or metadata endpoints.
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
  // IPv4 literal in a private/loopback/link-local range
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) {
      return false
    }
    if (a === 169 && b === 254) return false // link-local / cloud metadata
  }
  // IPv6 loopback / unique-local / link-local
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return false
  }
  return true
}

export function registerImportTools(server: McpServer, _api: ReturnType<typeof createApiClient>) {
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
        const res = await fetch(url, {
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'RecetarioBot/1.0', Accept: 'text/html' },
        })
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
