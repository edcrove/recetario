import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMcpServer, createApiClient } from '../index.js'
import { registerNutritionGoalTools } from './nutritionGoals.js'

function getToolHandler(server: ReturnType<typeof createMcpServer>, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (server as any)._registeredTools as Record<
    string,
    { handler: (...args: unknown[]) => unknown }
  >
  const tool = tools[name]
  if (!tool) throw new Error(`Tool "${name}" not registered`)
  return tool.handler
}

describe('nutrition goal tools', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('registers setNutritionGoals and getDayNutrition', () => {
    const server = createMcpServer()
    registerNutritionGoalTools(server, createApiClient())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (server as any)._registeredTools as Record<string, unknown>
    expect(tools['setNutritionGoals']).toBeDefined()
    expect(tools['getDayNutrition']).toBeDefined()
  })

  it('setNutritionGoals PATCHes the profile with nutritionTargets', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: 1 }) })
    vi.stubGlobal('fetch', mockFetch)
    const server = createMcpServer()
    registerNutritionGoalTools(server, createApiClient())
    const handler = getToolHandler(server, 'setNutritionGoals')
    await handler(
      {
        daily_calories: 2000,
        daily_protein_g: 100,
        daily_carbs_g: 250,
        daily_fat_g: 70,
        per_meal: { Almuerzo: { calories: 700 } },
      },
      {},
    )
    const [url, options] = mockFetch.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toContain('/auth/profile')
    expect(options.method).toBe('PATCH')
    const body = JSON.parse(options.body)
    expect(body.nutritionTargets.daily_calories).toBe(2000)
    expect(body.nutritionTargets.per_meal.Almuerzo.calories).toBe(700)
  })

  it('getDayNutrition GETs the day rollup', async () => {
    const rollup = { date: '2026-07-06', totals: { calories: 1500 }, delta: { calories: -500 } }
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(rollup) })
    vi.stubGlobal('fetch', mockFetch)
    const server = createMcpServer()
    registerNutritionGoalTools(server, createApiClient())
    const handler = getToolHandler(server, 'getDayNutrition')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await handler({ date: '2026-07-06' }, {})) as any
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toContain('/v1/menu/day-nutrition?date=2026-07-06')
    expect(JSON.parse(result.content[0].text)).toEqual(rollup)
  })
})
