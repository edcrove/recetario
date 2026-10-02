import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { invalidateMenuWeek, refreshAfter } from '../utils/menuCache'

describe('invalidateMenuWeek', () => {
  it('invalidates the planner, day nutrition, shopping list and fridge gap', () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    invalidateMenuWeek(client, '2026-06-29')
    expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([
      ['menu', '2026-06-29'],
      ['day-nutrition'],
      ['shopping-list', '2026-06-29'],
      ['menu-gap', '2026-06-29'],
    ])
  })
})

describe('refreshAfter', () => {
  const keysAfter = async (change: Parameters<typeof refreshAfter>[1]) => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    await refreshAfter(client, change)
    return spy.mock.calls.map((c) => c[0]?.queryKey)
  }

  it("a pantry edit refreshes the pantry, every week's missing view and the suggestions", async () => {
    expect(await keysAfter('pantry')).toEqual([
      ['pantry'],
      ['shopping-list'],
      ['menu-gap'],
      ['suggestions'],
    ])
  })

  it("a goal change refreshes every day's summary and the suggestions", async () => {
    expect(await keysAfter('goals')).toEqual([['day-nutrition'], ['suggestions']])
  })

  it('a recipe edit or delete refreshes everywhere the recipe shows', async () => {
    expect(await keysAfter('recipe')).toEqual([
      ['recipes'],
      ['menu'],
      ['day-nutrition'],
      ['shopping-list'],
      ['menu-gap'],
      ['suggestions'],
      ['collections'],
      ['collection-recipes'],
    ])
  })
})
