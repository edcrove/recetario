import { createHash, randomBytes } from 'node:crypto'

// API keys are random 256-bit tokens. SHA-256 without salt is the industry
// standard for token hashing (used by GitHub, npm, etc.). Not a password hash.
// lgtm[js/weak-cryptographic-algorithm]
export function generateApiKey(): { key: string; hash: string } {
  const key = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(key).digest('hex') // lgtm[js/weak-cryptographic-algorithm]
  return { key, hash }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex') // lgtm[js/weak-cryptographic-algorithm]
}

const { key, hash } = generateApiKey()
console.log('API Key:', key)
console.log('Key Hash (store in DB):', hash)
