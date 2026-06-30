import { createHash, randomBytes } from 'node:crypto'

export function generateApiKey(): { key: string; hash: string } {
  const key = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(key).digest('hex')
  return { key, hash }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

const { key, hash } = generateApiKey()
console.log('API Key:', key)
console.log('Key Hash (store in DB):', hash)
