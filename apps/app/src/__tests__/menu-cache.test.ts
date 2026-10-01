import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { invalidateMenuWeek } from '../utils/menuCache'

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
