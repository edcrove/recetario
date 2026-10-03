import { describe, it, expect, vi } from 'vitest'

const { rows } = vi.hoisted(() => ({ rows: { value: [] as { timezone: string | null }[] } }))
vi.mock('./transaction.js', () => ({
  currentDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => rows.value }) }) }),
  }),
}))
vi.mock('./index.js', () => ({ schema: { userProfiles: { timezone: 'tz', userId: 'uid' } } }))

import { userToday } from './user-time.js'

const USER = '550e8400-e29b-41d4-a716-446655440000'
// 01:30 UTC on Oct 3 is still Oct 2 in Montevideo (UTC-3)
const NIGHT = new Date('2026-10-03T01:30:00Z')

// 2026-10-02 review: "today" was the server's UTC day, so from 21:00 in
// Uruguay tonight's dinner already counted as yesterday's.
describe('userToday', () => {
  it("is the day in the user's profile time zone", async () => {
    rows.value = [{ timezone: 'America/Montevideo' }]
    expect(await userToday(USER, NIGHT)).toBe('2026-10-02')
  })

  it('falls back to UTC with no zone, no profile, or an API-key owner', async () => {
    rows.value = [{ timezone: null }]
    expect(await userToday(USER, NIGHT)).toBe('2026-10-03')
    rows.value = []
    expect(await userToday(USER, NIGHT)).toBe('2026-10-03')
    rows.value = [{ timezone: 'America/Montevideo' }]
    expect(await userToday('dev', NIGHT)).toBe('2026-10-03')
  })
})
