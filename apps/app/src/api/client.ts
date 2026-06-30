import type {
  Recipe,
  CreateRecipe,
  UpdateRecipe,
  MenuEntry,
  ShoppingListItem,
} from '@recetario/shared'

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
const STATIC_API_KEY = process.env['EXPO_PUBLIC_API_KEY'] ?? ''

// Lazily imported to avoid circular dependency with AuthProvider
async function getAuthToken(): Promise<string> {
  try {
    const { getStoredToken } = await import('../providers/AuthProvider')
    const token = await getStoredToken()
    return token ?? STATIC_API_KEY
  } catch {
    return STATIC_API_KEY
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`API ${res.status}: ${JSON.stringify(body)}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  recipes: {
    list: (params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {})
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
      return request<Recipe[]>(`/v1/recipes${qs ? `?${qs}` : ''}`)
    },
    search: (params: { q?: string; tag?: string; category?: string; ingredient?: string }) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null) as [string, string][],
      ).toString()
      return request<Recipe[]>(`/v1/recipes/search${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => request<Recipe>(`/v1/recipes/${id}`),
    create: (data: CreateRecipe) =>
      request<Recipe>('/v1/recipes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateRecipe) =>
      request<Recipe>(`/v1/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/v1/recipes/${id}`, { method: 'DELETE' }),
  },
  menu: {
    getWeek: (weekStart: string) => request<MenuEntry[]>(`/v1/menu?weekStart=${weekStart}`),
    add: (data: { date: string; slot: string; recipeId: string; servings: number }) =>
      request<MenuEntry>('/v1/menu', { method: 'POST', body: JSON.stringify(data) }),
    remove: (date: string, slot: string) =>
      request<void>(`/v1/menu/${date}/${encodeURIComponent(slot)}`, { method: 'DELETE' }),
    shoppingList: (weekStart: string) =>
      request<ShoppingListItem[]>(`/v1/menu/shopping-list?weekStart=${weekStart}`),
  },
  auth: {
    register: (data: { email: string; password: string; displayName?: string }) =>
      request<{ user: { id: string; email: string; displayName: string | null }; token: string }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(data) },
      ),
    login: (data: { email: string; password: string }) =>
      request<{ user: { id: string; email: string; displayName: string | null }; token: string }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(data) },
      ),
    me: () =>
      request<{ id: string; email: string; displayName: string | null; createdAt: string }>(
        '/auth/me',
      ),
    updateMe: (data: { displayName?: string; avatarUrl?: string }) =>
      request<{ id: string; email: string; displayName: string | null }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getProfile: () =>
      request<{
        preferredServings: number | null
        dietaryRestrictions: string[]
        allergens: string[]
        goals: string[]
        timezone: string | null
      }>('/auth/profile'),
    updateProfile: (data: {
      preferredServings?: number
      dietaryRestrictions?: string[]
      allergens?: string[]
      goals?: string[]
      timezone?: string
    }) =>
      request<{
        preferredServings: number | null
        dietaryRestrictions: string[]
        allergens: string[]
      }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  taxonomy: {
    foodTypes: () =>
      request<Array<{ id: string; name: string; slug: string; isSystem: boolean }>>(
        '/v1/food-types',
      ),
    collections: () =>
      request<
        Array<{
          id: string
          name: string
          emoji: string | null
          description: string | null
          recipeCount: number
        }>
      >('/v1/collections'),
    createCollection: (data: { name: string; emoji?: string; description?: string }) =>
      request<{ id: string; name: string; emoji: string | null }>('/v1/collections', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    addToCollection: (collectionId: string, recipeId: string) =>
      request<{ collectionId: string; recipeId: string }>(
        `/v1/collections/${collectionId}/recipes`,
        {
          method: 'POST',
          body: JSON.stringify({ recipeId }),
        },
      ),
    removeFromCollection: (collectionId: string, recipeId: string) =>
      request<void>(`/v1/collections/${collectionId}/recipes/${recipeId}`, { method: 'DELETE' }),
    relations: (recipeId: string) =>
      request<Array<{ fromId: string; toId: string; relationType: string }>>(
        `/v1/recipes/${recipeId}/relations`,
      ),
    addRelation: (fromId: string, toId: string, relationType: string) =>
      request<{ fromId: string; toId: string; relationType: string }>(
        `/v1/recipes/${fromId}/relations`,
        {
          method: 'POST',
          body: JSON.stringify({ toId, relationType }),
        },
      ),
  },
  cookSessions: {
    log: (data: { recipeId: string; rating?: number | null; notes?: string }) =>
      request<{
        id: string
        recipeId: string
        rating: number | null
        notes: string | null
        cookedAt: string
      }>('/v1/cook-sessions', { method: 'POST', body: JSON.stringify(data) }),
    listByRecipe: (recipeId: string, limit = 20) =>
      request<
        Array<{
          id: string
          recipeId: string
          rating: number | null
          notes: string | null
          cookedAt: string
        }>
      >(`/v1/cook-sessions?recipeId=${recipeId}&limit=${limit}`),
    stats: (since?: string) =>
      request<{
        totalSessions: number
        topRecipes: Array<{ recipeId: string; count: number; lastCookedAt: string }>
        frequencyByWeek: Array<{ week: string; count: number }>
      }>(`/v1/cook-sessions/stats${since ? `?since=${since}` : ''}`),
  },
  households: {
    create: (name: string) =>
      request<{ id: string; name: string; ownerId: string }>('/v1/households', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    mine: () =>
      request<
        Array<{
          id: string
          name: string
          ownerId: string
          members?: Array<{
            userId: string
            role: string
            invitedAt: string
            acceptedAt: string | null
          }>
        }>
      >('/v1/households/mine'),
    invite: (householdId: string, userId: string, role: string) =>
      request<{ userId: string; role: string }>(`/v1/households/${householdId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ userId, role }),
      }),
    accept: (householdId: string) =>
      request<{ userId: string; role: string }>(`/v1/households/${householdId}/accept`, {
        method: 'POST',
      }),
    removeMember: (householdId: string, userId: string) =>
      request<void>(`/v1/households/${householdId}/members/${userId}`, { method: 'DELETE' }),
  },
}
