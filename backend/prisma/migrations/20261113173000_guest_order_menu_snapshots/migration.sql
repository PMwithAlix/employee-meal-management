-- Additive guest-order snapshots. Columns are nullable so this step is
-- safe on an empty database and on a database that already has guest_orders.
-- Application validation still requires snapshots for newly created rows.

ALTER TABLE "guest_orders" ADD COLUMN IF NOT EXISTS "menuItemId" UUID;
ALTER TABLE "guest_orders" ADD COLUMN IF NOT EXISTS "buildingNameSnapshot" TEXT;
ALTER TABLE "guest_orders" ADD COLUMN IF NOT EXISTS "mealTitleSnapshot" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guest_orders_menuItemId_fkey'
  ) THEN
    ALTER TABLE "guest_orders"
      ADD CONSTRAINT "guest_orders_menuItemId_fkey"
      FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id")
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "guest_orders_menuItemId_idx" ON "guest_orders"("menuItemId");
