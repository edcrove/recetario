ALTER TABLE "cook_sessions" ADD COLUMN "servings" integer;--> statement-breakpoint
ALTER TABLE "cook_sessions" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "cook_sessions" ADD COLUMN "nutrition_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;