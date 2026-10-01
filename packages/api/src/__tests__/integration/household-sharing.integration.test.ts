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
  let householdId: string

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
    householdId = (await hhRes.json()).id

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
      // Sharing starts only once the invitee accepts.
      const acceptRes = await app.request(`/v1/households/${householdId}/accept`, {
        method: 'POST',
        headers: auth(user.token),
      })
      expect(acceptRes.status).toBe(200)
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

    it('week nutrition counts the same household entries as the day rollup', async () => {
      const putRes = await app.request(`/v1/recipes/${ownerRecipeId}`, {
        method: 'PUT',
        headers: auth(owner.token),
        body: JSON.stringify({
          nutrition: { calories: 400, protein_g: 20, carbs_g: 50, fat_g: 10 },
        }),
      })
      expect(putRes.status).toBe(200)

      // The member planned it; the owner's week and day views must both see it.
      const weekRes = await app.request(`/v1/menu/nutrition?weekStart=${weekStart}`, {
        headers: auth(owner.token),
      })
      const week = (await weekRes.json()) as { days: { date: string; calories: number }[] }
      const tuesday = week.days.find((d) => d.date === '2026-07-07')

      const dayRes = await app.request('/v1/menu/day-nutrition?date=2026-07-07', {
        headers: auth(owner.token),
      })
      const day = (await dayRes.json()) as { totals: { calories: number } }

      expect(tuesday?.calories).toBe(400)
      expect(day.totals.calories).toBe(tuesday?.calories)
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

    it('a viewer cannot write the shared pantry or check off the shopping list (403)', async () => {
      const pantryRes = await app.request('/v1/pantry', {
        method: 'POST',
        headers: auth(viewer.token),
        body: JSON.stringify({ name: 'Sal' }),
      })
      expect(pantryRes.status).toBe(403)

      const checkRes = await app.request('/v1/menu/shopping-list/check', {
        method: 'PUT',
        headers: auth(viewer.token),
        body: JSON.stringify({ weekStart: '2026-07-06', key: 'sal', checked: true }),
      })
      expect(checkRes.status).toBe(403)
    })

    it("a viewer's own recipe stays private to them", async () => {
      const createRes = await app.request('/v1/recipes', {
        method: 'POST',
        headers: auth(viewer.token),
        body: JSON.stringify({ ...baseRecipe, title: 'Receta del viewer' }),
      })
      expect(createRes.status).toBe(201)
      const viewerRecipeId = (await createRes.json()).id

      const ownRes = await app.request(`/v1/recipes/${viewerRecipeId}`, {
        headers: auth(viewer.token),
      })
      expect(ownRes.status).toBe(200)

      const ownerRes = await app.request(`/v1/recipes/${viewerRecipeId}`, {
        headers: auth(owner.token),
      })
      expect(ownerRes.status).toBe(404)
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

  // Regression: a pending (not yet accepted) invite used to share content in
  // both directions immediately, so inviting any registered email exposed that
  // user's private recipes/menu/pantry — and a pending *viewer* invite blocked
  // the invitee's own menu writes.
  describe('pending invitations share nothing', () => {
    let invitee: { token: string; userId: string }
    let inviteeRecipeId: string

    beforeAll(async () => {
      invitee = await register(`invitee-${Date.now()}@example.com`)
      const recipeRes = await app.request('/v1/recipes', {
        method: 'POST',
        headers: auth(invitee.token),
        body: JSON.stringify({ ...baseRecipe, title: 'Receta Privada del Invitado' }),
      })
      inviteeRecipeId = (await recipeRes.json()).id

      const inviteRes = await app.request(`/v1/households/${householdId}/invite`, {
        method: 'POST',
        headers: auth(owner.token),
        body: JSON.stringify({ userId: invitee.userId, role: 'viewer' }),
      })
      expect(inviteRes.status).toBe(201)
      expect((await inviteRes.json()).acceptedAt).toBeNull()
    })

    it("the inviter cannot see the invitee's private recipe", async () => {
      const detailRes = await app.request(`/v1/recipes/${inviteeRecipeId}`, {
        headers: auth(owner.token),
      })
      expect(detailRes.status).toBe(404)

      const listRes = await app.request('/v1/recipes?limit=100', { headers: auth(owner.token) })
      const ids = (await listRes.json()).map((r: { id: string }) => r.id)
      expect(ids).not.toContain(inviteeRecipeId)
    })

    it("the invitee cannot see the household's recipes before accepting", async () => {
      const res = await app.request(`/v1/recipes/${ownerRecipeId}`, {
        headers: auth(invitee.token),
      })
      expect(res.status).toBe(404)
    })

    it('a pending viewer invite does not block the invitee from their own menu', async () => {
      const res = await app.request('/v1/menu', {
        method: 'POST',
        headers: auth(invitee.token),
        body: JSON.stringify({
          date: '2026-07-09',
          slot: 'Cena',
          recipeId: inviteeRecipeId,
          servings: 2,
        }),
      })
      expect(res.status).toBe(200)
    })

    it('after accepting, the invitee sees the household recipes', async () => {
      const acceptRes = await app.request(`/v1/households/${householdId}/accept`, {
        method: 'POST',
        headers: auth(invitee.token),
      })
      expect(acceptRes.status).toBe(200)

      const res = await app.request(`/v1/recipes/${ownerRecipeId}`, {
        headers: auth(invitee.token),
      })
      expect(res.status).toBe(200)
    })
  })

  describe('invitation lifecycle and management rules', () => {
    it('GET /households/mine names every member (display name or email), not just ids', async () => {
      const res = await app.request('/v1/households/mine', { headers: auth(owner.token) })
      const [hh] = (await res.json()) as Array<{
        id: string
        members: Array<{ userId: string; email?: string; acceptedAt: string | null }>
      }>
      const me = hh!.members.find((m) => m.userId === owner.userId)
      expect(me?.email).toMatch(/^owner-.*@example\.com$/)
      expect(hh!.members.every((m) => typeof m.email === 'string')).toBe(true)
    })

    it('the invitee can decline a pending invitation, and then it is gone', async () => {
      const guest = await register(`guest-${Date.now()}@example.com`)
      await app.request(`/v1/households/${householdId}/invite`, {
        method: 'POST',
        headers: auth(owner.token),
        body: JSON.stringify({ userId: guest.userId, role: 'member' }),
      })
      const decline = await app.request(`/v1/households/${householdId}/decline`, {
        method: 'POST',
        headers: auth(guest.token),
      })
      expect(decline.status).toBe(204)
      const mine = await app.request('/v1/households/mine', { headers: auth(guest.token) })
      expect(await mine.json()).toEqual([])
      // An accepted membership can't be "declined"
      const again = await app.request(`/v1/households/${householdId}/decline`, {
        method: 'POST',
        headers: auth(member.token),
      })
      expect(again.status).toBe(404)
    })

    it('a pending admin cannot invite or remove anyone', async () => {
      const pendingAdmin = await register(`padmin-${Date.now()}@example.com`)
      await app.request(`/v1/households/${householdId}/invite`, {
        method: 'POST',
        headers: auth(owner.token),
        body: JSON.stringify({ userId: pendingAdmin.userId, role: 'admin' }),
      })
      const invite = await app.request(`/v1/households/${householdId}/invite`, {
        method: 'POST',
        headers: auth(pendingAdmin.token),
        body: JSON.stringify({ userId: outsider.userId, role: 'member' }),
      })
      expect(invite.status).toBe(403)
      const remove = await app.request(`/v1/households/${householdId}/members/${member.userId}`, {
        method: 'DELETE',
        headers: auth(pendingAdmin.token),
      })
      expect(remove.status).toBe(403)
    })

    it('the owner cannot be removed', async () => {
      const res = await app.request(`/v1/households/${householdId}/members/${owner.userId}`, {
        method: 'DELETE',
        headers: auth(owner.token),
      })
      expect(res.status).toBe(404)
    })
  })
})
