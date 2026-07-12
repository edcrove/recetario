import { describe, it, expect, beforeAll } from 'vitest'

const skip = process.env['SKIP_INTEGRATION'] === 'true'
import app from '../../index.js'
import { resetTestDb } from './globalSetup.js'

const fullRecipe = {
  title: 'Guiso Publicable',
  servings: 4,
  category: 'Cena' as const,
  tags: ['invierno', 'legumbres'],
  notes: 'Mejor al día siguiente.',
  yield: '1 olla',
  ingredients: [
    { name: 'lentejas', quantity: 500, unit: 'g' as const, presentation: 'remojadas' },
    { name: 'sal', quantity: null, unit: null },
  ],
  steps: [{ text: 'Rehogar.', durationSeconds: 600 }, { text: 'Hervir.' }],
  nutrition: { calories: 420, protein_g: 28, carbs_g: 52, fat_g: 12 },
  dietaryTags: ['sin-lactosa'],
  visibility: 'public' as const,
}

async function register(email: string, displayName?: string) {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', displayName }),
  })
  const body = await res.json()
  return { token: body.token as string, userId: body.user.id as string }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// Story: public library + copy-as-fork (sharing epic story 3).
describe.skipIf(skip).sequential('Public library and copy-as-fork', () => {
  let author: { token: string; userId: string }
  let visitor: { token: string; userId: string }
  let publicRecipeId: string
  let privateRecipeId: string

  beforeAll(async () => {
    await resetTestDb()
    author = await register(`autora-${Date.now()}@example.com`, 'Ana Cocinera')
    visitor = await register(`visitante-${Date.now()}@example.com`)

    const pubRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: auth(author.token),
      body: JSON.stringify(fullRecipe),
    })
    expect(pubRes.status).toBe(201)
    publicRecipeId = (await pubRes.json()).id

    const privRes = await app.request('/v1/recipes', {
      method: 'POST',
      headers: auth(author.token),
      body: JSON.stringify({ ...fullRecipe, title: 'Secreta', visibility: 'private' }),
    })
    privateRecipeId = (await privRes.json()).id
  })

  describe('GET /v1/library', () => {
    it('lists only public recipes, with the author display name', async () => {
      const res = await app.request('/v1/library', { headers: auth(visitor.token) })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { id: string; author: string; title: string }[]
      const titles = body.map((r) => r.title)
      expect(titles).toContain('Guiso Publicable')
      expect(titles).not.toContain('Secreta')
      expect(body.find((r) => r.id === publicRecipeId)?.author).toBe('Ana Cocinera')
    })

    it('never exposes author emails or ids', async () => {
      const res = await app.request('/v1/library', { headers: auth(visitor.token) })
      const raw = JSON.stringify(await res.json())
      expect(raw).not.toContain('@example.com')
      expect(raw).not.toContain(author.userId)
    })

    it('search filters by title', async () => {
      const res = await app.request('/v1/library?search=publicable', {
        headers: auth(visitor.token),
      })
      const body = (await res.json()) as { title: string }[]
      expect(body).toHaveLength(1)

      const none = await app.request('/v1/library?search=inexistente', {
        headers: auth(visitor.token),
      })
      expect(await none.json()).toEqual([])
    })

    it("falls back to 'Anónimo' when the author has no display name", async () => {
      const anon = await register(`anon-${Date.now()}@example.com`)
      const res = await app.request('/v1/recipes', {
        method: 'POST',
        headers: auth(anon.token),
        body: JSON.stringify({ ...fullRecipe, title: 'De Anónimo' }),
      })
      expect(res.status).toBe(201)

      const lib = await app.request('/v1/library?search=anónimo', {
        headers: auth(visitor.token),
      })
      const body = (await lib.json()) as { title: string; author: string }[]
      expect(body.find((r) => r.title === 'De Anónimo')?.author).toBe('Anónimo')
    })
  })

  describe('POST /v1/recipes/:id/copy', () => {
    let forkId: string

    it('forks a public recipe as a complete private snapshot', async () => {
      const res = await app.request(`/v1/recipes/${publicRecipeId}/copy`, {
        method: 'POST',
        headers: auth(visitor.token),
      })
      expect(res.status).toBe(201)
      const fork = await res.json()
      forkId = fork.id

      expect(fork.forkedFromId).toBe(publicRecipeId)
      expect(fork.visibility).toBe('private')
      expect(fork.title).toBe(fullRecipe.title)
      expect(fork.tags).toEqual(fullRecipe.tags)
      expect(fork.notes).toBe(fullRecipe.notes)
      expect(fork.nutrition).toEqual(fullRecipe.nutrition)
      expect(fork.dietaryTags).toEqual(fullRecipe.dietaryTags)
      expect(fork.ingredients).toHaveLength(2)
      expect(fork.ingredients[0]).toMatchObject({
        name: 'lentejas',
        quantity: 500,
        unit: 'g',
        presentation: 'remojadas',
      })
      expect(fork.steps).toHaveLength(2)
      expect(fork.steps[0]).toMatchObject({ text: 'Rehogar.', durationSeconds: 600 })
    })

    it('the fork belongs to the visitor and shows in their list', async () => {
      const res = await app.request('/v1/recipes?limit=100', { headers: auth(visitor.token) })
      const ids = ((await res.json()) as { id: string }[]).map((r) => r.id)
      expect(ids).toContain(forkId)
      expect(ids).not.toContain(publicRecipeId)
    })

    it('editing the fork never touches the original (and vice versa)', async () => {
      const editRes = await app.request(`/v1/recipes/${forkId}`, {
        method: 'PUT',
        headers: auth(visitor.token),
        body: JSON.stringify({
          title: 'Mi Versión Picante',
          ingredients: [{ name: 'ají', quantity: 2, unit: 'unit' }],
        }),
      })
      expect(editRes.status).toBe(200)

      const originalRes = await app.request(`/v1/recipes/${publicRecipeId}`, {
        headers: auth(author.token),
      })
      const original = await originalRes.json()
      expect(original.title).toBe(fullRecipe.title)
      expect(original.ingredients).toHaveLength(2)
      expect(original.ingredients[0].name).toBe('lentejas')

      // and the original's edits don't propagate forward either
      await app.request(`/v1/recipes/${publicRecipeId}`, {
        method: 'PUT',
        headers: auth(author.token),
        body: JSON.stringify({ notes: 'Actualizada por la autora' }),
      })
      const forkRes = await app.request(`/v1/recipes/${forkId}`, {
        headers: auth(visitor.token),
      })
      expect((await forkRes.json()).notes).toBe(fullRecipe.notes)
    })

    it('copying a nonexistent recipe returns 404', async () => {
      const res = await app.request('/v1/recipes/00000000-0000-4000-8000-000000000000/copy', {
        method: 'POST',
        headers: auth(visitor.token),
      })
      expect(res.status).toBe(404)
    })

    it("a housemate can copy the author's private recipe (household visibility)", async () => {
      const hhRes = await app.request('/v1/households', {
        method: 'POST',
        headers: auth(author.token),
        body: JSON.stringify({ name: 'Casa Fork' }),
      })
      const householdId = (await hhRes.json()).id
      const inviteRes = await app.request(`/v1/households/${householdId}/invite`, {
        method: 'POST',
        headers: auth(author.token),
        body: JSON.stringify({ userId: visitor.userId, role: 'member' }),
      })
      expect(inviteRes.status).toBe(201)

      const res = await app.request(`/v1/recipes/${privateRecipeId}/copy`, {
        method: 'POST',
        headers: auth(visitor.token),
      })
      expect(res.status).toBe(201)
      expect((await res.json()).forkedFromId).toBe(privateRecipeId)

      // leave the household so the earlier isolation assertions stay valid on reruns
      await app.request(`/v1/households/${householdId}/members/${visitor.userId}`, {
        method: 'DELETE',
        headers: auth(author.token),
      })
    })

    it("copying someone else's private recipe returns 404", async () => {
      const res = await app.request(`/v1/recipes/${privateRecipeId}/copy`, {
        method: 'POST',
        headers: auth(visitor.token),
      })
      expect(res.status).toBe(404)
    })

    it('the owner can copy their own private recipe', async () => {
      const res = await app.request(`/v1/recipes/${privateRecipeId}/copy`, {
        method: 'POST',
        headers: auth(author.token),
      })
      expect(res.status).toBe(201)
      expect((await res.json()).forkedFromId).toBe(privateRecipeId)
    })

    it('unpublishing hides the original from the library but keeps existing forks', async () => {
      const unpub = await app.request(`/v1/recipes/${publicRecipeId}`, {
        method: 'PUT',
        headers: auth(author.token),
        body: JSON.stringify({ visibility: 'private' }),
      })
      expect(unpub.status).toBe(200)

      const lib = await app.request('/v1/library?search=publicable', {
        headers: auth(visitor.token),
      })
      expect(await lib.json()).toEqual([])

      const forkRes = await app.request(`/v1/recipes/${forkId}`, {
        headers: auth(visitor.token),
      })
      expect(forkRes.status).toBe(200)
      expect((await forkRes.json()).forkedFromId).toBe(publicRecipeId)
    })
  })
})
