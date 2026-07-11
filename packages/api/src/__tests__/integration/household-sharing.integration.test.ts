import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetTestDb } from './globalSetup.js'

const baseRecipe = {
  title: 'Guiso Compartido',
  servings: 4,
  category: 'Cena' as const,
  ingredients: [{ name: 'lentejas', quantity: 500, unit: 'g' as const }],
  steps: [{ text: 'Cocinar a fuego lento.' }],
}

async function register(email: string): Promise<{ token: string; userId: string }> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  })
  const body = await res.json()
  return { token: body.token, userId: body.user.id }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// Story: household-shared reads + viewer role enforcement (sharing epic story 2).
// Four real users: owner + member + viewer share one household; outsider does not.
describe.skipIf(skip).sequential('Household sharing: reads and viewer enforcement', () => {
  let owner: { token: string; userId: string }
  let member: { token: string; userId: string }
  let viewer: { token: string; userId: string }
  let outsider: { token: string; userId: string }
  let ownerRecipeId: string

  beforeAll(async () => {
    await resetTestDb()

    owner = await register(`owner-${Date.now()}@example.com`)
    member = await register(`member-${Date.now()}@example.com`)
    viewer = await register(`viewer-${Date.now()}@example.com`)
    outsider = await register(`outsider-${Date.now()}@example.com`)

    const hhRes = await app.request('/v1/households', {
      method: 'POST',
      headers: auth(owner.token),
      body: JSON.stringify({ name: 'Casa Compartida' }),
    })
    const householdId = (await hhRes.json()).id

    for (const [user, role] of [
      [member, 'member'],
      [viewer, 'viewer'],
    ] as const) {
      const inviteRes = await app.request(`/v1/households/${householdId}/invite`, {
        method: 'POST',
        headers: auth(owner.token),
        body: JSON.stringify({ userId: user.userId, role }),
      })
      expect(inviteRes.status).toBe(201)
    }

    const recipeRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: auth(owner.token),
      body: JSON.stringify(baseRecipe),
    })
    expect(recipeRes.status).toBe(201)
    ownerRecipeId = (await recipeRes.json()).id
  })

  describe('recipe visibility across the household', () => {
    it("a member sees the owner's recipe in the list", async () => {
      const res = await app.request('/v1/recipes?limit=100', { headers: auth(member.token) })
      const ids = (await res.json()).map((r: { id: string }) => r.id)
      expect(ids).toContain(ownerRecipeId)
    })

    it("a member can open the owner's recipe detail", async () => {
      const res = await app.request(`/v1/recipes/${ownerRecipeId}`, {
        headers: auth(member.token),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).title).toBe(baseRecipe.title)
    })

    it("a viewer can also read the owner's recipe", async () => {
      const res = await app.request(`/v1/recipes/${ownerRecipeId}`, {
        headers: auth(viewer.token),
      })
      expect(res.status).toBe(200)
    })

    it('an outsider gets 404 on the detail and never sees it listed', async () => {
      const detailRes = await app.request(`/v1/recipes/${ownerRecipeId}`, {
        headers: auth(outsider.token),
      })
      expect(detailRes.status).toBe(404)

      const listRes = await app.request('/v1/recipes?limit=100', {
        headers: auth(outsider.token),
      })
      const ids = (await listRes.json()).map((r: { id: string }) => r.id)
      expect(ids).not.toContain(ownerRecipeId)
    })

    it("a housemate still cannot edit or delete the owner's recipe (404)", async () => {
      const putRes = await app.request(`/v1/recipes/${ownerRecipeId}`, {
        method: 'PUT',
        headers: auth(member.token),
        body: JSON.stringify({ title: 'Hackeado' }),
      })
      expect(putRes.status).toBe(404)

      const delRes = await app.request(`/v1/recipes/${ownerRecipeId}`, {
        method: 'DELETE',
        headers: auth(member.token),
      })
      expect(delRes.status).toBe(404)
    })
  })

  describe('shared menu week', () => {
    const weekStart = '2026-07-06'

    it("a member's menu entry shows up in the owner's week view", async () => {
      const postRes = await app.request('/v1/menu', {
        method: 'POST',
        headers: auth(member.token),
        body: JSON.stringify({
          date: '2026-07-07',
          slot: 'Cena',
          recipeId: ownerRecipeId,
          servings: 4,
        }),
      })
      expect(postRes.status).toBe(200)

      const weekRes = await app.request(`/v1/menu?weekStart=${weekStart}`, {
        headers: auth(owner.token),
      })
      const entries = (await weekRes.json()) as { recipeId: string | null }[]
      expect(entries.some((e) => e.recipeId === ownerRecipeId)).toBe(true)
    })

    it("the household's shopping list includes housemates' entries", async () => {
      const res = await app.request(`/v1/menu/shopping-list?weekStart=${weekStart}`, {
        headers: auth(owner.token),
      })
      expect(res.status).toBe(200)
      // "lentejas" resolves to the canonical "Lenteja" (key "lenteja").
      const items = (await res.json()) as { ingredient: string; key: string }[]
      expect(items.some((i) => i.key === 'lenteja')).toBe(true)
    })

    it("an outsider's week view stays empty", async () => {
      const res = await app.request(`/v1/menu?weekStart=${weekStart}`, {
        headers: auth(outsider.token),
      })
      expect(await res.json()).toEqual([])
    })

    it("a member's shopping check is shared with the household and the latest toggle wins", async () => {
      const shopping = async (token: string) => {
        const res = await app.request(`/v1/menu/shopping-list?weekStart=${weekStart}`, {
          headers: auth(token),
        })
        return (await res.json()) as { key: string; checked: boolean }[]
      }
      const check = (token: string, checked: boolean) =>
        app.request('/v1/menu/shopping-list/check', {
          method: 'PUT',
          headers: auth(token),
          body: JSON.stringify({ weekStart, key: 'lenteja', checked }),
        })

      // Member checks it off — the owner sees it checked.
      await check(member.token, true)
      let ownerList = await shopping(owner.token)
      expect(ownerList.find((i) => i.key === 'lenteja')?.checked).toBe(true)

      // Owner unchecks it — the member sees the newer state (latest toggle wins).
      await check(owner.token, false)
      const memberList = await shopping(member.token)
      expect(memberList.find((i) => i.key === 'lenteja')?.checked).toBe(false)
    })
  })

  describe('viewer role enforcement', () => {
    it('a viewer reads the shared week (200)', async () => {
      const res = await app.request('/v1/menu?weekStart=2026-07-06', {
        headers: auth(viewer.token),
      })
      expect(res.status).toBe(200)
    })

    it('a viewer cannot add a menu entry (403)', async () => {
      const res = await app.request('/v1/menu', {
        method: 'POST',
        headers: auth(viewer.token),
        body: JSON.stringify({
          date: '2026-07-08',
          slot: 'Almuerzo',
          recipeId: ownerRecipeId,
          servings: 2,
        }),
      })
      expect(res.status).toBe(403)
    })

    it('a viewer cannot delete or reschedule entries (403)', async () => {
      const delRes = await app.request(`/v1/menu/2026-07-07/Cena/${ownerRecipeId}`, {
        method: 'DELETE',
        headers: auth(viewer.token),
      })
      expect(delRes.status).toBe(403)

      const patchRes = await app.request(`/v1/menu/2026-07-07/Cena/${ownerRecipeId}`, {
        method: 'PATCH',
        headers: auth(viewer.token),
        body: JSON.stringify({ servings: 8 }),
      })
      expect(patchRes.status).toBe(403)
    })

    it('a member (non-viewer) can still modify the menu', async () => {
      const res = await app.request(`/v1/menu/2026-07-07/Cena/${ownerRecipeId}`, {
        method: 'PATCH',
        headers: auth(member.token),
        body: JSON.stringify({ servings: 6 }),
      })
      expect(res.status).toBe(200)
    })
  })
})
