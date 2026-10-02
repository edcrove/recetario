import { describe, it, expect, beforeAll } from 'vitest'
import type { ZodType } from 'zod'
import { createMcpServer, createApiClient, registerAllTools } from '../index.js'

// Agents only see these schemas: a regex or bound that silently loosens lets
// an agent send garbage the API then rejects with a less helpful error.
// Mutation testing (2026-10-01) showed the date regexes and numeric bounds in
// several tools could be changed without any test failing.

type Tool = { inputSchema?: { shape?: Record<string, ZodType> } }
let tools: Record<string, Tool>

beforeAll(async () => {
  const server = createMcpServer()
  await registerAllTools(server, createApiClient())
  tools = (server as unknown as { _registeredTools: Record<string, Tool> })._registeredTools
})

const field = (tool: string, name: string) => {
  const schema = tools[tool]?.inputSchema?.shape?.[name]
  if (!schema) throw new Error(`${tool}.${name} not found`)
  return schema
}

const ok = (s: ZodType, v: unknown) => s.safeParse(v).success

describe('every date-like argument takes exactly YYYY-MM-DD', () => {
  it('finds the date arguments it checks', () => {
    const dated = Object.entries(tools).flatMap(([name, t]) =>
      Object.keys(t.inputSchema?.shape ?? {})
        .filter((k) => k === 'date' || k === 'weekStart')
        .map((k) => `${name}.${k}`),
    )
    expect(dated).toEqual(expect.arrayContaining(['addToMenu.date', 'getMenu.weekStart']))
  })

  it.each(['2026-07-07'])('accepts %s', (v) => {
    for (const [name, t] of Object.entries(tools)) {
      for (const k of ['date', 'weekStart'] as const) {
        const s = t.inputSchema?.shape?.[k]
        if (s) expect(ok(s, v), `${name}.${k}`).toBe(true)
      }
    }
  })

  it.each([
    '2026-7-07',
    '2026-07-7',
    '26-07-07',
    'x2026-07-07',
    '2026-07-07x',
    '2026-07-0a',
    'aaaa-07-07',
  ])('rejects %s', (v) => {
    for (const [name, t] of Object.entries(tools)) {
      for (const k of ['date', 'weekStart'] as const) {
        const s = t.inputSchema?.shape?.[k]
        if (s) expect(ok(s, v), `${name}.${k}`).toBe(false)
      }
    }
  })
})

describe('numeric and text bounds', () => {
  it('servings must be a positive whole number', () => {
    const s = field('addToMenu', 'servings')
    expect(ok(s, 1)).toBe(true)
    expect(ok(s, 0)).toBe(false)
    expect(ok(s, -2)).toBe(false)
    expect(ok(s, 1.5)).toBe(false)
  })

  it('preferredServings is 1–20', () => {
    const s = field('updateProfile', 'preferredServings')
    expect(ok(s, 1)).toBe(true)
    expect(ok(s, 20)).toBe(true)
    expect(ok(s, 0)).toBe(false)
    expect(ok(s, 21)).toBe(false)
  })

  it('a recipe title in updateRecipe is 1–200 characters', () => {
    const s = field('updateRecipe', 'title')
    expect(ok(s, 'G')).toBe(true)
    expect(ok(s, 'x'.repeat(200))).toBe(true)
    expect(ok(s, '')).toBe(false)
    expect(ok(s, 'x'.repeat(201))).toBe(false)
  })

  it('pantry items need a name and a well-formed expiry date', () => {
    const s = field('update_pantry', 'items')
    expect(ok(s, [{ name: 'Leche', expiryDate: '2026-10-05' }])).toBe(true)
    expect(ok(s, [{ name: '' }])).toBe(false)
    expect(ok(s, [{ name: 'Leche', expiryDate: '5/10/2026' }])).toBe(false)
    expect(ok(s, [{ name: 'Leche', expiryDate: '2026-10-05T00:00' }])).toBe(false)
  })

  it('createRecipe defaults sourceType to mcp', () => {
    expect(field('createRecipe', 'sourceType').parse(undefined)).toBe('mcp')
  })
})

// 2026-10-02 review: addToMenu defaulted servings to 1, so an agent planning a
// dish for a family of four bought for one. Omitted servings now reach the API
// as omitted, and the API fills in the profile's default portions.
describe('addToMenu servings', () => {
  it('stays undefined when the agent leaves it out', () => {
    expect(field('addToMenu', 'servings').parse(undefined)).toBeUndefined()
    expect(field('addToMenu', 'servings').parse(3)).toBe(3)
    expect(ok(field('addToMenu', 'servings'), 0)).toBe(false)
  })
})
