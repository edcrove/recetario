import { createRouter } from './router.js'
import { createRoute as defineRoute, z } from '@hono/zod-openapi'
import { UserSchema } from '@recetario/shared'
import { accountRepository } from '../db/account-repository.js'
import { hashPassword, verifyPassword, signJwt } from '../auth/service.js'
import { authRateLimitMiddleware } from '../middleware/rateLimit.js'
import { registrationOpen } from '../config/production.js'
import { authMiddleware } from '../middleware/auth.js'
import { UUID_RE } from '../db/household-visibility.js'

export const authRoute = createRouter()

// Brute-force guard: per-IP limit on the unauthenticated credential endpoints
authRoute.use('/login', authRateLimitMiddleware)
authRoute.use('/register', authRateLimitMiddleware)
// JWT (app) or API key (MCP agents): same rules as every other authenticated route
authRoute.use('/me', authMiddleware)

const userResponseSchema = UserSchema

const authResponseSchema = z.object({
  user: userResponseSchema,
  token: z.string(),
})

const errorSchema = z.object({ error: z.string() })

// POST /auth/register
const registerRoute = defineRoute({
  method: 'post',
  path: '/register',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.email(),
            password: z.string().min(8),
            displayName: z.string().trim().min(1).max(100).optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: authResponseSchema } },
      description: 'Created',
    },
    403: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Registration closed (REGISTRATION_OPEN)',
    },
    409: { content: { 'application/json': { schema: errorSchema } }, description: 'Email taken' },
  },
})

authRoute.openapi(registerRoute, async (c) => {
  if (!registrationOpen()) {
    return c.json({ error: 'Registration is closed' }, 403)
  }
  const { email, password, displayName } = c.req.valid('json')
  if (await accountRepository.findUserByEmail(email)) {
    return c.json({ error: 'Email already registered' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const user = await accountRepository.createUser({
    email,
    passwordHash,
    displayName: displayName ?? null,
  })

  const token = await signJwt({ sub: user.id, email: user.email })
  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    },
    201,
  )
})

// POST /auth/login
const loginRoute = defineRoute({
  method: 'post',
  path: '/login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.email(),
            password: z.string(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: authResponseSchema } }, description: 'OK' },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Invalid credentials',
    },
  },
})

authRoute.openapi(loginRoute, async (c) => {
  const { email, password } = c.req.valid('json')
  const user = await accountRepository.findUserByEmail(email)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  await accountRepository.recordLogin(user.id)
  const token = await signJwt({ sub: user.id, email: user.email })
  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    },
    200,
  )
})

// GET /auth/me
const meRoute = defineRoute({
  method: 'get',
  path: '/me',
  security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: userResponseSchema } }, description: 'OK' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: 'Unauthorized' },
  },
})

authRoute.openapi(meRoute, async (c) => {
  const userId: string = c.get('ownerId')
  // Legacy/dev owners ('dev', 'test-owner') are not users
  if (!UUID_RE.test(userId)) {
    return c.json({ error: 'User not found' }, 401)
  }

  const user = await accountRepository.findUserById(userId)
  if (!user) return c.json({ error: 'User not found' }, 401)

  return c.json(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    },
    200,
  )
})
