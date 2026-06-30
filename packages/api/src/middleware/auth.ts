import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import { createHash } from 'node:crypto'
import { getDb } from '../db/index.js'
import { schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { verifyJwt } from '../auth/service.js'

declare module 'hono' {
  interface ContextVariableMap {
    ownerId: string
  }
}

export const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }
  const token = authHeader.slice(7)

  try {
    const db = getDb()

    // 1. Try JWT first (app users)
    const jwtPayload = await verifyJwt(token)
    if (jwtPayload) {
      c.set('ownerId', jwtPayload.sub)
      await next()
      return
    }

    // 2. Try API key (MCP agents / external integrations)
    const keyHash = createHash('sha256').update(token).digest('hex') // lgtm[js/weak-cryptographic-algorithm]
    const [apiKey] = await db
      .select()
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.keyHash, keyHash))
      .limit(1)

    if (apiKey) {
      c.set('ownerId', apiKey.ownerId)
      await next()
      return
    }

    return c.json({ error: 'Invalid API key' }, 401)
  } catch {
    // DB unavailable — fall back to DEV_API_KEY for CI/dev
    const envKey = process.env['DEV_API_KEY']
    if (envKey && token === envKey) {
      c.set('ownerId', 'dev')
      await next()
      return
    }
    return c.json({ error: 'Invalid API key' }, 401)
  }
})
