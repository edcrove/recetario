CREATE TABLE "canonical_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"family_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ingredient_families_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ingredient_synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"synonym" text NOT NULL,
	"canonical_id" uuid NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canonical_ingredients" ADD CONSTRAINT "canonical_ingredients_family_id_ingredient_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."ingredient_families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_synonyms" ADD CONSTRAINT "ingredient_synonyms_canonical_id_canonical_ingredients_id_fk" FOREIGN KEY ("canonical_id") REFERENCES "public"."canonical_ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_ingredients_normalized_idx" ON "canonical_ingredients" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "canonical_ingredients_family_idx" ON "canonical_ingredients" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_synonyms_synonym_idx" ON "ingredient_synonyms" USING btree ("synonym");--> statement-breakpoint
CREATE INDEX "ingredient_synonyms_canonical_idx" ON "ingredient_synonyms" USING btree ("canonical_id");