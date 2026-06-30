import { describe, it, expect, vi } from 'vitest'
import { DEMO_RECIPES } from '@recetario/shared'

vi.mock('../db/repository.js', () => ({
  RecipeRepository: vi.fn().mockImplementation(() => ({
    upsert: vi.fn().mockResolvedValue({ recipe: { id: 'mock-id', title: 'Mock' }, created: true }),
  })),
}))

import { seedRecipes } from './seed.js'

describe('seedRecipes', () => {
  it('calls upsert once per DEMO_RECIPE', async () => {
    const { RecipeRepository } = await import('../db/repository.js')
    const mockUpsert = vi
      .fn()
      .mockResolvedValue({ recipe: { id: 'id', title: 'T' }, created: true })
    vi.mocked(RecipeRepository).mockImplementation(() => ({ upsert: mockUpsert }) as never)

    await seedRecipes('test-owner')

    expect(mockUpsert).toHaveBeenCalledTimes(DEMO_RECIPES.length)
  })

  it('passes the correct ownerId to each upsert call', async () => {
    const { RecipeRepository } = await import('../db/repository.js')
    const mockUpsert = vi
      .fn()
      .mockResolvedValue({ recipe: { id: 'id', title: 'T' }, created: true })
    vi.mocked(RecipeRepository).mockImplementation(() => ({ upsert: mockUpsert }) as never)

    await seedRecipes('custom-owner')

    for (const call of mockUpsert.mock.calls) {
      expect(call[0]).toBe('custom-owner')
    }
  })

  it('seeds all DEMO_RECIPES (content check)', async () => {
    const { RecipeRepository } = await import('../db/repository.js')
    const seededTitles: string[] = []
    vi.mocked(RecipeRepository).mockImplementation(
      () =>
        ({
          upsert: vi.fn().mockImplementation((_, recipe) => {
            seededTitles.push(recipe.title)
            return Promise.resolve({ recipe: { id: 'id', title: recipe.title }, created: true })
          }),
        }) as never,
    )

    await seedRecipes('owner')

    expect(seededTitles.sort()).toEqual(DEMO_RECIPES.map((r) => r.title).sort())
  })
})
