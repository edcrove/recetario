-- Custom SQL migration file, put your code below! --
-- 2026-10-01 audit (Data): the last calendar date stored as text. Values are ISO
-- YYYY-MM-DD from the API's z.iso.date() check; drizzle can't cast text to date
-- without USING (same reason as 0017).
ALTER TABLE "pantry_items" ALTER COLUMN "expiry_date" SET DATA TYPE date USING "expiry_date"::date;
