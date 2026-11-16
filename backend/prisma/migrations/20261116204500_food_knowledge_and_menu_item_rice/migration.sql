-- Snapshot rice classification on each menu item. Existing rows stay non-rice.
ALTER TABLE "menu_items"
  ADD COLUMN "isRice" BOOLEAN NOT NULL DEFAULT false;

-- Independent food-name memory. Not backfilled from titles (no automatic rice detection).
CREATE TABLE "food_knowledge" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "isRice" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "food_knowledge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_knowledge_normalizedName_key" ON "food_knowledge"("normalizedName");
