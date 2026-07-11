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
import { ingredientsRoute } from './routes/ingredients.js'
import { pantryRoute } from './routes/pantry.js'
import { configRoute } from './routes/config.js'
import { assertJwtSecretConfigured } from './auth/service.js'

assertJwtSecretConfigured()

export const app = new OpenAPIHono()

app.use(
  '*',
  cors({
    // Allow localhost (Expo web :8081, docker app :8080, Expo Go :19006, ...),
    // any private-LAN host so other devices on the router can reach the API,
    // and anything configured via CORS_ORIGIN for production.
    origin: (origin) => {
      if (!origin) return origin
      const allowed = process.env['CORS_ORIGIN']?.split(',').map((o) => o.trim()) ?? []
      if (allowed.includes(origin)) return origin
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin
      // RFC 1918 private ranges: 10.x, 172.16-31.x, 192.168.x (any port)
      if (
        /^https?:\/\/(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})(?::\d+)?$/.test(
          origin,
        )
      ) {
        return origin
      }
      return null
    },
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
app.route('/v1', ingredientsRoute)
app.route('/v1', pantryRoute)
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
