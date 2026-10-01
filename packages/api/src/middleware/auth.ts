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

/**
 * A JWT issued before the user's last password reset is no longer valid. Only a
 * positive match revokes: a lookup error is left to fail the request later.
 */
async function isRevoked(userId: string, iat: number): Promise<boolean> {
  try {
    const [user] = await getDb()
      .select({ passwordChangedAt: schema.users.passwordChangedAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    const changedAt = user?.passwordChangedAt
    return !!changedAt && iat * 1000 < changedAt.getTime() - 1000
  } catch {
    return false
  }
}

const API_KEY_TOUCH_MS = 60 * 60 * 1000

/** Records API key use (at most hourly, fire-and-forget) so stale keys can be found. */
function touchApiKey(id: string, lastUsedAt: Date | null): void {
  if (lastUsedAt && Date.now() - lastUsedAt.getTime() < API_KEY_TOUCH_MS) return
  void getDb()
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, id))
    .then(
      () => undefined,
      () => undefined,
    )
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
      if (await isRevoked(jwtPayload.sub, jwtPayload.iat)) {
        return c.json({ error: 'Session expired, please sign in again' }, 401)
      }
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
      touchApiKey(apiKey.id, apiKey.lastUsedAt)
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
