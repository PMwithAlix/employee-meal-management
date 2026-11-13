-- Make snapshot columns nullable so historical guest orders can remain
-- without inventing a menu option. Backfill building names only when the
-- building row still exists. Do not guess menuItemId.

ALTER TABLE "guest_orders"
  ALTER COLUMN "menuItemId" DROP NOT NULL,
  ALTER COLUMN "buildingNameSnapshot" DROP NOT NULL,
  ALTER COLUMN "mealTitleSnapshot" DROP NOT NULL;

UPDATE "guest_orders" AS g
SET "buildingNameSnapshot" = b."name"
FROM "buildings" AS b
WHERE g."buildingId" = b."id"
  AND g."buildingNameSnapshot" IS NULL;
