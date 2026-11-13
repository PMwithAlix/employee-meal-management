-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'HR', 'SUPPORT', 'MANAGEMENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "MenuVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "OrderCycleStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GuestOrderStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GuestOrderAction" AS ENUM ('CREATED', 'UPDATED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "buildingId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "endedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "publishedVersionId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "menuId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "MenuVersionStatus" NOT NULL,
    "publishedAt" TIMESTAMPTZ(6),
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "menuVersionId" UUID NOT NULL,
    "mealDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "title" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "mealDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "currentCycleId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "menuItemId" UUID NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "usernameSnapshot" TEXT NOT NULL,
    "buildingIdSnapshot" UUID,
    "buildingNameSnapshot" TEXT,
    "mealTitleSnapshot" TEXT NOT NULL,
    "mealDateSnapshot" DATE NOT NULL,
    "mealTypeSnapshot" "MealType" NOT NULL,
    "status" "OrderCycleStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderCycleId" UUID NOT NULL,
    "oldStatus" "OrderCycleStatus",
    "newStatus" "OrderCycleStatus" NOT NULL,
    "actorId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_group_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderCycleId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "groupNameSnapshot" TEXT NOT NULL,

    CONSTRAINT "order_group_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "buildingId" UUID NOT NULL,
    "mealDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "status" "GuestOrderStatus" NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guest_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_order_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guestOrderId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" "GuestOrderAction" NOT NULL,
    "beforeData" JSONB NOT NULL,
    "afterData" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_order_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_deadlines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mealDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "deadlineAt" TIMESTAMPTZ(6) NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mealType" "MealType" NOT NULL,
    "servingTime" TIME(0) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meal_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderCycleId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_buildingId_idx" ON "users"("buildingId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");

-- CreateIndex
CREATE INDEX "group_memberships_groupId_idx" ON "group_memberships"("groupId");

-- CreateIndex
CREATE INDEX "group_memberships_userId_idx" ON "group_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "menus_publishedVersionId_key" ON "menus"("publishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "menus_year_month_key" ON "menus"("year", "month");

-- CreateIndex
CREATE INDEX "menu_versions_menuId_idx" ON "menu_versions"("menuId");

-- CreateIndex
CREATE INDEX "menu_versions_createdBy_idx" ON "menu_versions"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "menu_versions_menuId_versionNumber_key" ON "menu_versions"("menuId", "versionNumber");

-- CreateIndex
CREATE INDEX "menu_items_menuVersionId_idx" ON "menu_items"("menuVersionId");

-- CreateIndex
CREATE INDEX "menu_items_mealDate_mealType_idx" ON "menu_items"("mealDate", "mealType");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_menuVersionId_mealDate_mealType_displayOrder_key" ON "menu_items"("menuVersionId", "mealDate", "mealType", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "orders_currentCycleId_key" ON "orders"("currentCycleId");

-- CreateIndex
CREATE INDEX "orders_userId_idx" ON "orders"("userId");

-- CreateIndex
CREATE INDEX "orders_mealDate_mealType_idx" ON "orders"("mealDate", "mealType");

-- CreateIndex
CREATE UNIQUE INDEX "orders_userId_mealDate_mealType_key" ON "orders"("userId", "mealDate", "mealType");

-- CreateIndex
CREATE INDEX "order_cycles_orderId_idx" ON "order_cycles"("orderId");

-- CreateIndex
CREATE INDEX "order_cycles_menuItemId_idx" ON "order_cycles"("menuItemId");

-- CreateIndex
CREATE INDEX "order_cycles_status_idx" ON "order_cycles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "order_cycles_orderId_cycleNumber_key" ON "order_cycles"("orderId", "cycleNumber");

-- CreateIndex
CREATE INDEX "order_status_history_orderCycleId_idx" ON "order_status_history"("orderCycleId");

-- CreateIndex
CREATE INDEX "order_status_history_actorId_idx" ON "order_status_history"("actorId");

-- CreateIndex
CREATE INDEX "order_status_history_createdAt_idx" ON "order_status_history"("createdAt");

-- CreateIndex
CREATE INDEX "order_group_snapshots_orderCycleId_idx" ON "order_group_snapshots"("orderCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "order_group_snapshots_orderCycleId_groupId_key" ON "order_group_snapshots"("orderCycleId", "groupId");

-- CreateIndex
CREATE INDEX "guest_orders_buildingId_idx" ON "guest_orders"("buildingId");

-- CreateIndex
CREATE INDEX "guest_orders_mealDate_mealType_idx" ON "guest_orders"("mealDate", "mealType");

-- CreateIndex
CREATE INDEX "guest_orders_createdBy_idx" ON "guest_orders"("createdBy");

-- CreateIndex
CREATE INDEX "guest_order_history_guestOrderId_idx" ON "guest_order_history"("guestOrderId");

-- CreateIndex
CREATE INDEX "guest_order_history_actorId_idx" ON "guest_order_history"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "order_deadlines_createdBy_idx" ON "order_deadlines"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "order_deadlines_mealDate_mealType_key" ON "order_deadlines"("mealDate", "mealType");

-- CreateIndex
CREATE UNIQUE INDEX "meal_settings_mealType_key" ON "meal_settings"("mealType");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_orderCycleId_key" ON "ratings"("orderCycleId");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "menu_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "menu_versions" ADD CONSTRAINT "menu_versions_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "menu_versions" ADD CONSTRAINT "menu_versions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menuVersionId_fkey" FOREIGN KEY ("menuVersionId") REFERENCES "menu_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_currentCycleId_fkey" FOREIGN KEY ("currentCycleId") REFERENCES "order_cycles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_cycles" ADD CONSTRAINT "order_cycles_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_cycles" ADD CONSTRAINT "order_cycles_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderCycleId_fkey" FOREIGN KEY ("orderCycleId") REFERENCES "order_cycles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_group_snapshots" ADD CONSTRAINT "order_group_snapshots_orderCycleId_fkey" FOREIGN KEY ("orderCycleId") REFERENCES "order_cycles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_group_snapshots" ADD CONSTRAINT "order_group_snapshots_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "guest_orders" ADD CONSTRAINT "guest_orders_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "guest_orders" ADD CONSTRAINT "guest_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "guest_order_history" ADD CONSTRAINT "guest_order_history_guestOrderId_fkey" FOREIGN KEY ("guestOrderId") REFERENCES "guest_orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "guest_order_history" ADD CONSTRAINT "guest_order_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_deadlines" ADD CONSTRAINT "order_deadlines_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "meal_settings" ADD CONSTRAINT "meal_settings_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_orderCycleId_fkey" FOREIGN KEY ("orderCycleId") REFERENCES "order_cycles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Domain integrity Prisma cannot express.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "users"
  ADD CONSTRAINT "users_username_normalized_chk"
  CHECK ("username" = lower(btrim("username")) AND "username" <> '');

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_building_chk"
  CHECK ("role" = 'ADMIN' OR "buildingId" IS NOT NULL);

CREATE OR REPLACE FUNCTION prevent_username_change()
RETURNS trigger AS $$
BEGIN
  IF NEW."username" IS DISTINCT FROM OLD."username" THEN
    RAISE EXCEPTION 'username is immutable after create';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_username_immutable
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION prevent_username_change();

ALTER TABLE "group_memberships"
  ADD CONSTRAINT "group_memberships_range_chk"
  CHECK ("endedAt" IS NULL OR "endedAt" > "startedAt");

CREATE UNIQUE INDEX "group_memberships_active_unique"
  ON "group_memberships" ("groupId", "userId")
  WHERE "endedAt" IS NULL;

ALTER TABLE "group_memberships"
  ADD CONSTRAINT "group_memberships_no_overlap"
  EXCLUDE USING gist (
    "groupId" WITH =,
    "userId" WITH =,
    tstzrange("startedAt", COALESCE("endedAt", 'infinity'::timestamptz), '[)') WITH &&
  );

ALTER TABLE "menus"
  ADD CONSTRAINT "menus_month_chk"
  CHECK ("month" BETWEEN 1 AND 12 AND "year" >= 1);

ALTER TABLE "menu_versions"
  ADD CONSTRAINT "menu_versions_number_chk"
  CHECK ("versionNumber" >= 1);

CREATE OR REPLACE FUNCTION menus_published_version_same_menu()
RETURNS trigger AS $$
BEGIN
  IF NEW."publishedVersionId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM "menu_versions" mv
    WHERE mv."id" = NEW."publishedVersionId"
      AND mv."menuId" = NEW."id"
      AND mv."status" = 'PUBLISHED'
  ) THEN
    RAISE EXCEPTION 'publishedVersionId must reference a PUBLISHED version of the same menu';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER menus_published_version_guard
BEFORE INSERT OR UPDATE OF "publishedVersionId" ON "menus"
FOR EACH ROW
EXECUTE FUNCTION menus_published_version_same_menu();

ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_display_order_chk"
  CHECK ("displayOrder" BETWEEN 1 AND 3);

CREATE OR REPLACE FUNCTION menu_items_limit_per_meal()
RETURNS trigger AS $$
DECLARE
  item_count integer;
BEGIN
  SELECT COUNT(*) INTO item_count
  FROM "menu_items"
  WHERE "menuVersionId" = NEW."menuVersionId"
    AND "mealDate" = NEW."mealDate"
    AND "mealType" = NEW."mealType"
    AND "id" IS DISTINCT FROM NEW."id";

  IF item_count + 1 > 3 THEN
    RAISE EXCEPTION 'each meal may have at most 3 menu items';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER menu_items_limit_per_meal_guard
BEFORE INSERT OR UPDATE OF "menuVersionId", "mealDate", "mealType" ON "menu_items"
FOR EACH ROW
EXECUTE FUNCTION menu_items_limit_per_meal();

CREATE OR REPLACE FUNCTION prevent_published_menu_item_mutation()
RETURNS trigger AS $$
DECLARE
  version_status "MenuVersionStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT "status" INTO version_status FROM "menu_versions" WHERE "id" = OLD."menuVersionId";
    IF version_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'published menu versions are immutable';
    END IF;
    RETURN OLD;
  END IF;

  SELECT "status" INTO version_status FROM "menu_versions" WHERE "id" = NEW."menuVersionId";
  IF version_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'published menu versions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER menu_items_published_immutable
BEFORE INSERT OR UPDATE OR DELETE ON "menu_items"
FOR EACH ROW
EXECUTE FUNCTION prevent_published_menu_item_mutation();

ALTER TABLE "order_cycles"
  ADD CONSTRAINT "order_cycles_number_chk"
  CHECK ("cycleNumber" >= 1);

CREATE UNIQUE INDEX "order_cycles_one_active"
  ON "order_cycles" ("orderId")
  WHERE "status" = 'ACTIVE';

CREATE OR REPLACE FUNCTION protect_order_cycle_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'order cycles cannot be deleted';
  END IF;
  IF NEW."orderId" IS DISTINCT FROM OLD."orderId"
     OR NEW."cycleNumber" IS DISTINCT FROM OLD."cycleNumber"
     OR NEW."menuItemId" IS DISTINCT FROM OLD."menuItemId"
     OR NEW."usernameSnapshot" IS DISTINCT FROM OLD."usernameSnapshot"
     OR NEW."buildingIdSnapshot" IS DISTINCT FROM OLD."buildingIdSnapshot"
     OR NEW."buildingNameSnapshot" IS DISTINCT FROM OLD."buildingNameSnapshot"
     OR NEW."mealTitleSnapshot" IS DISTINCT FROM OLD."mealTitleSnapshot"
     OR NEW."mealDateSnapshot" IS DISTINCT FROM OLD."mealDateSnapshot"
     OR NEW."mealTypeSnapshot" IS DISTINCT FROM OLD."mealTypeSnapshot" THEN
    RAISE EXCEPTION 'order cycle historical fields are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_cycles_history_guard
BEFORE UPDATE OR DELETE ON "order_cycles"
FOR EACH ROW
EXECUTE FUNCTION protect_order_cycle_history();

ALTER TABLE "guest_orders"
  ADD CONSTRAINT "guest_orders_quantity_chk"
  CHECK ("quantity" >= 1);

ALTER TABLE "ratings"
  ADD CONSTRAINT "ratings_score_chk"
  CHECK ("score" BETWEEN 1 AND 5);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();
