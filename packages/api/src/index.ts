import { Hono } from 'hono'
import { VERSION } from '@recetario/shared'

console.log(`@recetario/api starting (shared version: ${VERSION})`)

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
