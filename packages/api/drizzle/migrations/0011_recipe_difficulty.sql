CREATE TYPE "public"."recipe_difficulty" AS ENUM('fácil', 'media', 'difícil');--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "difficulty" "recipe_difficulty";