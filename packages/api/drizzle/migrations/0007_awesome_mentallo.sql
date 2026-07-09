CREATE TYPE "public"."recipe_visibility" AS ENUM('private', 'public');--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "visibility" "recipe_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "forked_from_id" uuid;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_forked_from_id_recipes_id_fk" FOREIGN KEY ("forked_from_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipes_visibility_idx" ON "recipes" USING btree ("visibility");