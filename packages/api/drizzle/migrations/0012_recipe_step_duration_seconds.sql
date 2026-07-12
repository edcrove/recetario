ALTER TABLE "steps" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
UPDATE "steps" SET "duration_seconds" = "duration_min" * 60 WHERE "duration_min" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "steps" DROP COLUMN "duration_min";
