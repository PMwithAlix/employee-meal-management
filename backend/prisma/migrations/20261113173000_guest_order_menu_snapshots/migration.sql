-- Additive guest-order snapshots. The table is empty in current
-- environments; new NOT NULL columns are therefore safe.

ALTER TABLE "guest_orders"
  ADD COLUMN "menuItemId" UUID NOT NULL,
  ADD COLUMN "buildingNameSnapshot" TEXT NOT NULL,
  ADD COLUMN "mealTitleSnapshot" TEXT NOT NULL;

ALTER TABLE "guest_orders"
  ADD CONSTRAINT "guest_orders_menuItemId_fkey"
  FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "guest_orders_menuItemId_idx" ON "guest_orders"("menuItemId");
