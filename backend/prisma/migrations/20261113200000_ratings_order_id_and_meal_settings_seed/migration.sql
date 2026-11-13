-- One rating row per employee order. Existing rows (if any) inherit
-- orderId from the rated cycle. Meal serving clocks stay in meal_settings;
-- application code reads them instead of hardcoding hours.

ALTER TABLE "ratings" ADD COLUMN IF NOT EXISTS "orderId" UUID;

UPDATE "ratings" AS r
SET "orderId" = c."orderId"
FROM "order_cycles" AS c
WHERE r."orderCycleId" = c."id"
  AND r."orderId" IS NULL;

DELETE FROM "ratings" WHERE "orderId" IS NULL;

ALTER TABLE "ratings" ALTER COLUMN "orderId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ratings_orderId_key'
  ) THEN
    ALTER TABLE "ratings" ADD CONSTRAINT "ratings_orderId_key" UNIQUE ("orderId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ratings_orderId_fkey'
  ) THEN
    ALTER TABLE "ratings"
      ADD CONSTRAINT "ratings_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "ratings_orderId_idx" ON "ratings"("orderId");
