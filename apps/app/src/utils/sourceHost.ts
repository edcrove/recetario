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
