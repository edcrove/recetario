import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(),
    title: text('title').notNull(),
    servings: integer('servings').notNull(),
    category: text('category').notNull(),
    tags: jsonb('tags').notNull().default([]),
    prepTimeMin: integer('prep_time_min'),
    cookTimeMin: integer('cook_time_min'),
    totalTimeMin: integer('total_time_min'),
    images: jsonb('images').notNull().default([]),
    notes: text('notes'),
    yield: text('yield'),
    originalLanguage: text('original_language').notNull().default('es'),
    translations: jsonb('translations').notNull().default([]),
    // source stored as jsonb for MVP simplicity
    source: jsonb('source'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('recipes_owner_idx').on(t.ownerId), index('recipes_category_idx').on(t.category)],
)

export const ingredients = pgTable(
  'ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    quantity: text('quantity'), // stored as text to preserve null vs "0" distinction
    unit: text('unit'),
    presentation: text('presentation'),
    group: text('group'),
    note: text('note'),
  },
  (t) => [index('ingredients_recipe_idx').on(t.recipeId)],
)

export const steps = pgTable(
  'steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    text: text('text').notNull(),
    durationMin: integer('duration_min'),
    ovenTempC: integer('oven_temp_c'),
  },
  (t) => [index('steps_recipe_idx').on(t.recipeId)],
)

// Dedupe index: one recipe per (ownerId, source.url) and (ownerId, source.externalId)
// Enforced at application level since jsonb partial indexes need raw SQL
export const recipeSources = pgTable(
  'recipe_sources',
  {
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    sourceUrl: text('source_url'),
    externalId: text('external_id'),
  },
  (t) => [
    uniqueIndex('recipe_sources_owner_url_idx').on(t.ownerId, t.sourceUrl),
    uniqueIndex('recipe_sources_owner_ext_idx').on(t.ownerId, t.externalId),
  ],
)

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyHash: text('key_hash').notNull().unique(),
  ownerId: text('owner_id').notNull(),
  label: text('label'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
})
