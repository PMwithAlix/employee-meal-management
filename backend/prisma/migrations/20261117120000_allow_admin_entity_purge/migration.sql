-- Admin permanent-delete transactions set khaan.purge=on (SET LOCAL)
-- so order-cycle and audit immutability still hold for ordinary writes.

CREATE OR REPLACE FUNCTION protect_order_cycle_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('khaan.purge', true) = 'on' THEN
      RETURN OLD;
    END IF;
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

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('khaan.purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$ LANGUAGE plpgsql;
