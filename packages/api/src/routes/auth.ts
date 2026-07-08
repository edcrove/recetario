import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db/index.js'
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '../auth/service.js'

export const authRoute = new OpenAPIHono()

const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().nullable(),
  createdAt: z.string(),
})

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
            displayName: z.string().min(1).max(100).optional(),
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
    409: { content: { 'application/json': { schema: errorSchema } }, description: 'Email taken' },
  },
})

authRoute.openapi(registerRoute, async (c) => {
  const { email, password, displayName } = c.req.valid('json')
  const db = getDb()

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)
  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash, displayName: displayName ?? null })
    .returning()

  // Create empty profile
  await db.insert(schema.userProfiles).values({ userId: user!.id }).onConflictDoNothing()

  const token = await signJwt({ sub: user!.id, email: user!.email })
  return c.json(
    {
      user: {
        id: user!.id,
        email: user!.email,
        displayName: user!.displayName,
        createdAt: user!.createdAt.toISOString(),
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
  const db = getDb()

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: 'Invalid email or password' } as never, 401)
  }

  const token = await signJwt({ sub: user.id, email: user.email })
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  } as never)
})

// GET /auth/me
const meRoute = defineRoute({
  method: 'get',
  path: '/me',
  security: [{ BearerAuth: [] }],
  responses: {
    200: { content: { 'application/json': { schema: userResponseSchema } }, description: 'OK' },
    401: { content: { 'application/json': { schema: errorSchema } }, description: 'Unauthorized' },
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
authRoute.openapi(meRoute as any, async (c: any) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' } as never, 401)
  }

  const payload = await verifyJwt(authHeader.slice(7) as string)
  if (!payload) return c.json({ error: 'Invalid or expired token' } as never, 401)

  const db = getDb()
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, payload.sub))
    .limit(1)
  if (!user) return c.json({ error: 'User not found' } as never, 401)

  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  })
})
