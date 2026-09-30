import { describe, it, expect } from 'vitest'
import { isHttpUrl, sourceHost } from './sourceHost'

describe('sourceHost', () => {
  it('strips scheme, path, and a www prefix', () => {
    expect(sourceHost('https://www.cookpad.com/receta/123')).toBe('cookpad.com')
  })

  it('keeps a non-www host as-is', () => {
    expect(sourceHost('https://recetasgratis.net/foo')).toBe('recetasgratis.net')
  })

  it('falls back to the raw string when the URL is unparseable', () => {
    expect(sourceHost('not a url')).toBe('not a url')
  })
})

describe('isHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isHttpUrl('https://cookpad.com/x')).toBe(true)
    expect(isHttpUrl('HTTP://example.com')).toBe(true)
  })

  it('rejects script, data and other schemes', () => {
    expect(isHttpUrl('javascript:alert(document.domain)')).toBe(false)
    expect(isHttpUrl(' JavaScript:alert(1)')).toBe(false)
    expect(isHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isHttpUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects unparseable strings', () => {
    expect(isHttpUrl('not a url')).toBe(false)
  })
})
