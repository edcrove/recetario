CREATE TYPE "public"."menu_slot" AS ENUM('Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros');--> statement-breakpoint
CREATE TABLE "menu_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"date" text NOT NULL,
	"slot" "menu_slot" NOT NULL,
	"recipe_id" uuid NOT NULL,
	"servings" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_entries" ADD CONSTRAINT "menu_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_entries_owner_date_slot_idx" ON "menu_entries" USING btree ("owner_id","date","slot");--> statement-breakpoint
CREATE INDEX "menu_entries_owner_idx" ON "menu_entries" USING btree ("owner_id");