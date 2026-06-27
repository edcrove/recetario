import { createHash, randomBytes } from 'node:crypto'

const key = randomBytes(32).toString('hex')
const hash = createHash('sha256').update(key).digest('hex')
console.log('API Key:', key)
console.log('Key Hash (store in DB):', hash)
