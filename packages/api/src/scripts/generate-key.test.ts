import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { generateApiKey, hashApiKey } from './generate-key.js'

describe('generateApiKey', () => {
  it('generates a 64-char hex key (32 bytes)', () => {
    const { key } = generateApiKey()
    expect(key).toHaveLength(64)
    expect(key).toMatch(/^[0-9a-f]+$/)
  })

  it('generates a 64-char SHA-256 hash', () => {
    const { hash } = generateApiKey()
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('hash matches SHA-256 of the generated key', () => {
    const { key, hash } = generateApiKey()
    // API keys are random 256-bit tokens — SHA-256 without salt is the industry
    // standard (GitHub, npm). CodeQL flags this as a password hash; it is not.
    // lgtm[js/weak-cryptographic-algorithm]
    expect(hash).toBe(createHash('sha256').update(key).digest('hex'))
  })

  it('different calls produce different keys and hashes', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.key).not.toBe(b.key)
    expect(a.hash).not.toBe(b.hash)
  })
})

describe('hashApiKey', () => {
  it('is deterministic for a given input', () => {
    expect(hashApiKey('my-key')).toBe(hashApiKey('my-key'))
  })

  it('different inputs produce different hashes', () => {
    expect(hashApiKey('key-a')).not.toBe(hashApiKey('key-b'))
  })

  it('matches manual SHA-256', () => {
    expect(hashApiKey('test')).toBe(createHash('sha256').update('test').digest('hex'))
  })
})
