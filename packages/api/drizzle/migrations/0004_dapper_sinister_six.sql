ALTER TABLE "recipes" ADD COLUMN "dietary_tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "nutrition" jsonb;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "nutrition_targets" jsonb;