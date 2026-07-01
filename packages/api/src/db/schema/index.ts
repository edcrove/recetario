import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const menuSlot = pgEnum('menu_slot', [
  'Desayuno',
  'Almuerzo',
  'Merienda',
  'Cena',
  'Snacks/Otros',
])

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
    // dietary tags: vegano, vegetariano, sin-gluten, sin-lactosa, keto, paleo
    dietaryTags: jsonb('dietary_tags').default([]),
    // nutrition per serving: { calories, protein_g, carbs_g, fat_g, fiber_g? }
    nutrition: jsonb('nutrition'),
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

export const menuEntries = pgTable(
  'menu_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(),
    date: text('date').notNull(), // ISO date YYYY-MM-DD
    slot: menuSlot('slot').notNull(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    servings: integer('servings').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('menu_entries_owner_date_slot_idx').on(t.ownerId, t.date, t.slot),
    index('menu_entries_owner_idx').on(t.ownerId),
  ],
)

// ── Identity ─────────────────────────────────────────────────────────────────
export const householdRole = pgEnum('household_role', ['owner', 'admin', 'member', 'viewer'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  preferredServings: integer('preferred_servings').default(2),
  dietaryRestrictions: jsonb('dietary_restrictions').notNull().default([]),
  allergens: jsonb('allergens').notNull().default([]),
  goals: jsonb('goals').notNull().default([]),
  timezone: text('timezone').default('UTC'),
  // nutrition targets per day: { daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g }
  nutritionTargets: jsonb('nutrition_targets'),
})

export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const householdMembers = pgTable(
  'household_members',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: householdRole('role').notNull().default('member'),
    invitedAt: timestamp('invited_at').notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at'),
  },
  (t) => [uniqueIndex('household_members_pk').on(t.householdId, t.userId)],
)

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyHash: text('key_hash').notNull().unique(),
  ownerId: text('owner_id').notNull(),
  label: text('label'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
})

// ── Taxonomy: meal categories (replaces category text enum) ─────────────────
export const mealCategories = pgTable(
  'meal_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id'), // null = system-wide
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    color: text('color'),
    isSystem: integer('is_system').notNull().default(0), // 1 = cannot delete
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('meal_categories_slug_owner_idx').on(t.slug, t.ownerId)],
)

// ── Taxonomy: food types (guisos, sopas, carnes…) ───────────────────────────
export const foodTypes = pgTable(
  'food_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id'), // null = system-wide
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    isSystem: integer('is_system').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('food_types_slug_owner_idx').on(t.slug, t.ownerId)],
)

export const recipeFoodTypes = pgTable(
  'recipe_food_types',
  {
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    foodTypeId: uuid('food_type_id')
      .notNull()
      .references(() => foodTypes.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('recipe_food_types_pk').on(t.recipeId, t.foodTypeId)],
)

// ── Taxonomy: normalized tags ────────────────────────────────────────────────
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tags_slug_owner_idx').on(t.slug, t.ownerId)],
)

export const recipeTags = pgTable(
  'recipe_tags',
  {
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('recipe_tags_pk').on(t.recipeId, t.tagId)],
)

// ── Collections ──────────────────────────────────────────────────────────────
export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  emoji: text('emoji'),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const recipeCollections = pgTable(
  'recipe_collections',
  {
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    addedAt: timestamp('added_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('recipe_collections_pk').on(t.recipeId, t.collectionId)],
)

// ── Recipe relations ─────────────────────────────────────────────────────────
export const recipeRelations = pgTable(
  'recipe_relations',
  {
    fromId: uuid('from_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    toId: uuid('to_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    relationType: text('relation_type').notNull(), // 'similar' | 'variation' | 'inspiration'
    createdBy: text('created_by').notNull().default('user'), // 'user' | 'agent'
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('recipe_relations_pk').on(t.fromId, t.toId, t.relationType)],
)

// ── Cook sessions (history & analytics) ─────────────────────────────────────
export const cookSessions = pgTable(
  'cook_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    cookedAt: timestamp('cooked_at').notNull().defaultNow(),
    rating: integer('rating'), // 1–5, nullable
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('cook_sessions_owner_idx').on(t.ownerId),
    index('cook_sessions_recipe_idx').on(t.recipeId),
    index('cook_sessions_cooked_at_idx').on(t.cookedAt),
  ],
)
