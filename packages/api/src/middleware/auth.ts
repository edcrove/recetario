import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import { createHash } from 'node:crypto'
import { getDb } from '../db/index.js'
import { schema } from '../db/index.js'
import { eq } from 'drizzle-orm'

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
  const key = authHeader.slice(7)
  const keyHash = createHash('sha256').update(key).digest('hex')

  try {
    const db = getDb()
    const [apiKey] = await db
      .select()
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.keyHash, keyHash))
      .limit(1)

    if (!apiKey) {
      return c.json({ error: 'Invalid API key' }, 401)
    }

    c.set('ownerId', apiKey.ownerId)
  } catch {
    // If DB is not available (e.g. tests without DB), fall back to env-based key
    const envKey = process.env['DEV_API_KEY']
    if (envKey && key === envKey) {
      c.set('ownerId', 'dev')
    } else {
      return c.json({ error: 'Invalid API key' }, 401)
    }
  }

  await next()
})
