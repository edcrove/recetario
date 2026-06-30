CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cook_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"cooked_at" timestamp DEFAULT now() NOT NULL,
	"rating" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_system" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text,
	"is_system" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_collections" (
	"recipe_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_food_types" (
	"recipe_id" uuid NOT NULL,
	"food_type_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_relations" (
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"created_by" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_tags" (
	"recipe_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cook_sessions" ADD CONSTRAINT "cook_sessions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_collections" ADD CONSTRAINT "recipe_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_food_types" ADD CONSTRAINT "recipe_food_types_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_food_types" ADD CONSTRAINT "recipe_food_types_food_type_id_food_types_id_fk" FOREIGN KEY ("food_type_id") REFERENCES "public"."food_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_relations" ADD CONSTRAINT "recipe_relations_from_id_recipes_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_relations" ADD CONSTRAINT "recipe_relations_to_id_recipes_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cook_sessions_owner_idx" ON "cook_sessions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "cook_sessions_recipe_idx" ON "cook_sessions" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "cook_sessions_cooked_at_idx" ON "cook_sessions" USING btree ("cooked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "food_types_slug_owner_idx" ON "food_types" USING btree ("slug","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_categories_slug_owner_idx" ON "meal_categories" USING btree ("slug","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_collections_pk" ON "recipe_collections" USING btree ("recipe_id","collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_food_types_pk" ON "recipe_food_types" USING btree ("recipe_id","food_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_relations_pk" ON "recipe_relations" USING btree ("from_id","to_id","relation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_tags_pk" ON "recipe_tags" USING btree ("recipe_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_owner_idx" ON "tags" USING btree ("slug","owner_id");