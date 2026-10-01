DROP INDEX "food_types_slug_owner_idx";--> statement-breakpoint
DROP INDEX "meal_categories_slug_owner_idx";--> statement-breakpoint
ALTER TABLE "food_types" ADD CONSTRAINT "food_types_slug_owner_uq" UNIQUE NULLS NOT DISTINCT("slug","owner_id");--> statement-breakpoint
ALTER TABLE "meal_categories" ADD CONSTRAINT "meal_categories_slug_owner_uq" UNIQUE NULLS NOT DISTINCT("slug","owner_id");