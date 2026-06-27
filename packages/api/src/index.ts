import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { VERSION } from '@recetario/shared'
import { healthRoute } from './routes/health.js'

export const app = new OpenAPIHono()

app.openAPIRegistry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'Authorization',
  description: 'API key as "Bearer <key>"',
})

app.route('/', healthRoute)

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'Recetario API', version: '1.0.0' },
})

app.get('/docs', swaggerUI({ url: '/openapi.json' }))

console.log(`@recetario/api starting (shared v${VERSION})`)

export default app
