import type {
  Recipe,
  CreateRecipe,
  UpdateRecipe,
  MenuEntry,
  ShoppingListItem,
} from '@recetario/shared'

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['EXPO_PUBLIC_API_KEY'] ?? ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
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
}
