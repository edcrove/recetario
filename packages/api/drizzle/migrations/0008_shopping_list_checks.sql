CREATE TABLE "shopping_list_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"week_start" text NOT NULL,
	"item_key" text NOT NULL,
	"checked" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_list_checks_owner_week_item_idx" ON "shopping_list_checks" USING btree ("owner_id","week_start","item_key");--> statement-breakpoint
CREATE INDEX "shopping_list_checks_owner_week_idx" ON "shopping_list_checks" USING btree ("owner_id","week_start");