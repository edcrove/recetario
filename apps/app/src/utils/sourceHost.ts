/**
 * Human-friendly host for a recipe's source URL ("www.cookpad.com/x" → "cookpad.com").
 * Falls back to the raw string if the URL can't be parsed, so a malformed
 * `source.url` (which the schema shouldn't allow, but data can rot) never crashes
 * the recipe detail render.
 */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * True only for http(s) URLs. The schema rejects other schemes on write, but
 * rows stored before that check (or copied from the library) may still hold a
 * `javascript:`/`data:` URL, which Linking.openURL would run on web.
 */
export function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
