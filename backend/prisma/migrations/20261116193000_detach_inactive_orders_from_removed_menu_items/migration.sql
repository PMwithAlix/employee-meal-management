ALTER TABLE "order_cycles"
  ALTER COLUMN "menuItemId" DROP NOT NULL;

ALTER TABLE "order_cycles"
  DROP CONSTRAINT "order_cycles_menuItemId_fkey";

ALTER TABLE "order_cycles"
  ADD CONSTRAINT "order_cycles_menuItemId_fkey"
  FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id")
  ON DELETE SET NULL
  ON UPDATE RESTRICT;

ALTER TABLE "guest_orders"
  DROP CONSTRAINT IF EXISTS "guest_orders_menuItemId_fkey";

ALTER TABLE "guest_orders"
  ADD CONSTRAINT "guest_orders_menuItemId_fkey"
  FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id")
  ON DELETE SET NULL
  ON UPDATE RESTRICT;

CREATE OR REPLACE FUNCTION protect_order_cycle_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'order cycles cannot be deleted';
  END IF;
  IF NEW."orderId" IS DISTINCT FROM OLD."orderId"
     OR NEW."cycleNumber" IS DISTINCT FROM OLD."cycleNumber"
     OR NEW."usernameSnapshot" IS DISTINCT FROM OLD."usernameSnapshot"
     OR NEW."buildingIdSnapshot" IS DISTINCT FROM OLD."buildingIdSnapshot"
     OR NEW."buildingNameSnapshot" IS DISTINCT FROM OLD."buildingNameSnapshot"
     OR NEW."mealTitleSnapshot" IS DISTINCT FROM OLD."mealTitleSnapshot"
     OR NEW."mealDateSnapshot" IS DISTINCT FROM OLD."mealDateSnapshot"
     OR NEW."mealTypeSnapshot" IS DISTINCT FROM OLD."mealTypeSnapshot" THEN
    RAISE EXCEPTION 'order cycle historical fields are immutable';
  END IF;
  IF NEW."menuItemId" IS DISTINCT FROM OLD."menuItemId" THEN
    IF NEW."menuItemId" IS NOT NULL THEN
      RAISE EXCEPTION 'order cycle historical fields are immutable';
    END IF;
    IF OLD."status" = 'ACTIVE' THEN
      RAISE EXCEPTION 'cannot detach menu item from an active order cycle';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
