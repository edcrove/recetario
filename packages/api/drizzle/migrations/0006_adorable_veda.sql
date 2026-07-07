ALTER TABLE "cook_sessions" DROP CONSTRAINT "cook_sessions_recipe_id_recipes_id_fk";
--> statement-breakpoint
ALTER TABLE "menu_entries" DROP CONSTRAINT "menu_entries_recipe_id_recipes_id_fk";
--> statement-breakpoint
ALTER TABLE "cook_sessions" ALTER COLUMN "recipe_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_entries" ALTER COLUMN "recipe_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cook_sessions" ADD COLUMN "recipe_title" text;--> statement-breakpoint
ALTER TABLE "menu_entries" ADD COLUMN "recipe_title" text;--> statement-breakpoint
ALTER TABLE "cook_sessions" ADD CONSTRAINT "cook_sessions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_entries" ADD CONSTRAINT "menu_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;