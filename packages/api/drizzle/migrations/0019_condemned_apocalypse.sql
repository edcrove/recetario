CREATE TYPE "public"."menu_entry_status" AS ENUM('planned', 'cooked', 'skipped');--> statement-breakpoint
ALTER TABLE "menu_entries" ADD COLUMN "status" "menu_entry_status" DEFAULT 'planned' NOT NULL;