import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'
import { VERSION } from '@recetario/shared'
import { healthRoute } from './routes/health.js'
import { recipesRoute } from './routes/recipes.js'
import { menuRoute } from './routes/menu.js'
import { authRoute } from './routes/auth.js'
import { profileRoute } from './routes/profile.js'
import { householdsRoute } from './routes/households.js'
import { cookSessionsRoute } from './routes/cook-sessions.js'
import { taxonomyRoute } from './routes/taxonomy.js'
import { configRoute } from './routes/config.js'
import { assertJwtSecretConfigured } from './auth/service.js'

assertJwtSecretConfigured()

export const app = new OpenAPIHono()

app.use(
  '*',
  cors({
    origin: ['http://localhost:8081', 'http://localhost:3000', 'http://localhost:19006'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.openAPIRegistry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'Authorization',
  description: 'API key as "Bearer <key>"',
})

app.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

app.route('/', healthRoute)
app.route('/v1', recipesRoute)
app.route('/v1', menuRoute)
app.route('/auth', authRoute)
app.route('/auth', profileRoute)
app.route('/v1/households', householdsRoute)
app.route('/v1/cook-sessions', cookSessionsRoute)
app.route('/v1', taxonomyRoute)
app.route('/v1/config', configRoute)

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'Recetario API', version: '1.0.0' },
})

app.get('/docs', swaggerUI({ url: '/openapi.json' }))

console.log(`@recetario/api starting (shared v${VERSION})`)

// Start HTTP server when run directly (not in test environment)
if (process.env['NODE_ENV'] !== 'test') {
  const { serve } = await import('@hono/node-server')
  const port = Number(process.env['PORT'] ?? 3000)
  serve({ fetch: app.fetch, port })
  console.log(`🚀 API running at http://localhost:${port}`)
  console.log(`📖 Docs at http://localhost:${port}/docs`)
}

export default app
