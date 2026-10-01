-- System taxonomy rows (owner_id IS NULL) were inserted again on every seed run because
-- the (slug, owner_id) unique index treated NULLs as distinct. Keep the oldest row per
-- slug, repoint recipe links to it, then delete the copies. 0014 makes the index
-- NULLS NOT DISTINCT so this cannot happen again.
WITH ranked AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn,
         first_value(id) OVER (PARTITION BY slug ORDER BY created_at, id) AS keeper
  FROM food_types WHERE owner_id IS NULL
)
INSERT INTO recipe_food_types (recipe_id, food_type_id)
SELECT rft.recipe_id, ranked.keeper
FROM recipe_food_types rft JOIN ranked ON ranked.id = rft.food_type_id
WHERE ranked.rn > 1
ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM food_types ft
USING (
  SELECT id, row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM food_types WHERE owner_id IS NULL
) d
WHERE ft.id = d.id AND d.rn > 1;--> statement-breakpoint
DELETE FROM meal_categories mc
USING (
  SELECT id, row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM meal_categories WHERE owner_id IS NULL
) d
WHERE mc.id = d.id AND d.rn > 1;
