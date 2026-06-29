import { describe, it, expect } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'

function generateApiKey() {
  const key = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(key).digest('hex')
  return { key, hash }
}

describe('generate-key script logic', () => {
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

  it('hash is deterministic for a given key', () => {
    const key = 'fixed-test-key'
    const hash1 = createHash('sha256').update(key).digest('hex')
    const hash2 = createHash('sha256').update(key).digest('hex')
    expect(hash1).toBe(hash2)
  })

  it('different keys produce different hashes', () => {
    const { key: key1, hash: hash1 } = generateApiKey()
    const { key: key2, hash: hash2 } = generateApiKey()
    expect(key1).not.toBe(key2)
    expect(hash1).not.toBe(hash2)
  })

  it('hash matches manual SHA-256 of the generated key', () => {
    const { key, hash } = generateApiKey()
    const expected = createHash('sha256').update(key).digest('hex')
    expect(hash).toBe(expected)
  })
})
