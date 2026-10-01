import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetTestDb } from './globalSetup.js'

// MCP ↔ API contract: the MCP tool handlers run against the real Hono app and a real
// Postgres, authenticated with a real API key, the way an agent uses them. The MCP
// package's own unit tests mock the HTTP client, which is how 204 bodies, per-serving
// nutrition and API-key auth on /auth/me went wrong unnoticed (audit 2026-09-30).
const BASE = 'http://mcp-contract.test'

type ToolResult = { content: Array<{ text: string }> }
type Handler = (args: Record<string, unknown>, extra: unknown) => Promise<ToolResult>

describe.skipIf(skip).sequential('MCP tools against the real API', () => {
  let tools: Record<string, { handler: Handler }>
  let email: string

  beforeAll(async () => {
    await resetTestDb()
    email = `mcp-${Date.now()}@example.com`
    const reg = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    })
    const { user } = (await reg.json()) as { user: { id: string } }

    const key = randomBytes(32).toString('hex')
    const { getDb, schema } = await import('../../db/index.js')
    await getDb()
      .insert(schema.apiKeys)
      .values({
        keyHash: createHash('sha256').update(key).digest('hex'), // lgtm[js/weak-cryptographic-algorithm]
        ownerId: user.id,
        label: 'mcp-contract',
      })

    // The MCP client reads these at import time and calls global fetch
    process.env['API_BASE_URL'] = BASE
    process.env['MCP_API_KEY'] = key
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
      app.request(url.replace(BASE, ''), init),
    )
    // Path held in a variable so tsc doesn't pull the MCP sources under this package's rootDir
    const mcpEntry = new URL('../../../../mcp/src/index.ts', import.meta.url).href
    const mcp = (await import(/* @vite-ignore */ mcpEntry)) as {
      createMcpServer: () => object
      createApiClient: () => object
      registerAllTools: (server: object, api: object) => Promise<void>
    }
    const server = mcp.createMcpServer()
    await mcp.registerAllTools(server, mcp.createApiClient())
    tools = (server as unknown as { _registeredTools: typeof tools })._registeredTools
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await tools[name]!.handler(args, {})
    return result.content[0]!.text
  }

  it('whoami works with an API key (not only a JWT)', async () => {
    expect(await call('whoami')).toContain(email)
  })

  it('create → menu add → remove one recipe → cook → history → macros → delete', async () => {
    const created = JSON.parse(
      await call('createRecipe', {
        title: 'Contrato MCP',
        servings: 4,
        category: 'Cena',
        ingredients: [{ name: 'lentejas', quantity: 400, unit: 'g' }],
        steps: [{ text: 'Cocinar.' }],
        nutrition: { calories: 400, protein_g: 20, carbs_g: 60, fat_g: 10 },
      }),
    ) as { recipe: { id: string } }
    const id = created.recipe.id

    await call('addToMenu', { date: '2026-10-05', slot: 'Cena', recipeId: id, servings: 2 })
    // 204 from the API is success, not "Unexpected end of JSON input"
    expect(
      await call('removeFromMenu', { date: '2026-10-05', slot: 'Cena', recipeId: id }),
    ).toContain('Removed recipe')

    await call('logCookSession', { recipeId: id, rating: 5 })
    const history = JSON.parse(await call('getCookHistory', {})) as Array<{ recipeId: string }>
    expect(history.map((s) => s.recipeId)).toContain(id)

    // Nutrition is per serving: 2 servings of a 400 kcal/serving recipe = 800 kcal
    expect(JSON.parse(await call('getMacros', { recipeId: id, servings: 2 }))).toMatchObject({
      calories: 800,
    })

    expect(await call('deleteRecipe', { id })).not.toMatch(/error/i)
    const res = await app.request(`/v1/recipes/${id}`, {
      headers: { Authorization: `Bearer ${process.env['MCP_API_KEY']}` },
    })
    expect(res.status).toBe(404)
  })
})
