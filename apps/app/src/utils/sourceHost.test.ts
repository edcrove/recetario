import { describe, it, expect } from 'vitest'
import { sourceHost } from './sourceHost'

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
