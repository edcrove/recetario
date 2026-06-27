CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"owner_id" text NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" text,
	"unit" text,
	"presentation" text,
	"group" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "recipe_sources" (
	"recipe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"source_url" text,
	"external_id" text
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"servings" integer NOT NULL,
	"category" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prep_time_min" integer,
	"cook_time_min" integer,
	"total_time_min" integer,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"yield" text,
	"original_language" text DEFAULT 'es' NOT NULL,
	"translations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"duration_min" integer,
	"oven_temp_c" integer
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_sources" ADD CONSTRAINT "recipe_sources_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredients_recipe_idx" ON "ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_sources_owner_url_idx" ON "recipe_sources" USING btree ("owner_id","source_url");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_sources_owner_ext_idx" ON "recipe_sources" USING btree ("owner_id","external_id");--> statement-breakpoint
CREATE INDEX "recipes_owner_idx" ON "recipes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recipes_category_idx" ON "recipes" USING btree ("category");--> statement-breakpoint
CREATE INDEX "steps_recipe_idx" ON "steps" USING btree ("recipe_id");