import { describe, it, expect } from 'vitest'
import {
  CookStatsSchema,
  RecipeRelationSchema,
  SuggestionSchema,
  TaxonomyOverviewSchema,
} from './taxonomy.js'

const ID = '11111111-1111-4111-8111-111111111111'

describe('taxonomy and history contracts', () => {
  it('accepts a configurator overview where tags carry no isSystem', () => {
    const item = { id: ID, name: 'Cena', slug: 'cena', usageCount: 0, isDeletable: false }
    expect(
      TaxonomyOverviewSchema.parse({
        mealCategories: [{ ...item, isSystem: true }],
        foodTypes: [],
        tags: [item],
      }).tags[0]?.isSystem,
    ).toBeUndefined()
  })

  it('rejects an unknown relation type', () => {
    const relation = { fromId: ID, toId: ID, relationType: 'similar', createdBy: 'agent' }
    expect(RecipeRelationSchema.safeParse(relation).success).toBe(true)
    expect(RecipeRelationSchema.safeParse({ ...relation, relationType: 'clone' }).success).toBe(
      false,
    )
  })

  it('accepts a suggestion without nutrition and stats with an empty window', () => {
    expect(
      SuggestionSchema.parse({
        id: ID,
        title: 'Guiso',
        matchedCount: 2,
        totalCount: 3,
        matchFraction: 2 / 3,
        missingIngredients: ['sal'],
        goalFit: null,
        nutrition: null,
        usesExpiring: [],
        recentlyCooked: false,
        avgRating: null,
      }).goalFit,
    ).toBeNull()
    expect(
      CookStatsSchema.parse({
        since: '2026-07-01',
        totalSessions: 0,
        topRecipes: [],
        frequencyByWeek: [],
        streak: { current: 0, longest: 0 },
      }).totalSessions,
    ).toBe(0)
    // The streak is part of the contract: a payload without it is rejected
    expect(
      CookStatsSchema.safeParse({
        since: '2026-07-01',
        totalSessions: 0,
        topRecipes: [],
        frequencyByWeek: [],
      }).success,
    ).toBe(false)
  })
})
