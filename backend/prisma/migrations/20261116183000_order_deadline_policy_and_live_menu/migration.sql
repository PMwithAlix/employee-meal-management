-- Global lunch/dinner order-deadline policy. Historical per-day rows in
-- order_deadlines are kept for audit but are no longer the runtime source.

CREATE TYPE "DeadlineDayRelation" AS ENUM ('SAME_DAY', 'PREVIOUS_DAY');

CREATE TABLE "order_deadline_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mealType" "MealType" NOT NULL,
    "relation" "DeadlineDayRelation" NOT NULL,
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "updatedBy" UUID,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_deadline_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_deadline_policies_hour_check" CHECK ("hour" >= 0 AND "hour" <= 23),
    CONSTRAINT "order_deadline_policies_minute_check" CHECK ("minute" >= 0 AND "minute" <= 59)
);

CREATE UNIQUE INDEX "order_deadline_policies_mealType_key" ON "order_deadline_policies"("mealType");

ALTER TABLE "order_deadline_policies"
ADD CONSTRAINT "order_deadline_policies_updatedBy_fkey"
FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

INSERT INTO "order_deadline_policies" ("mealType", "relation", "hour", "minute")
VALUES
    ('LUNCH', 'SAME_DAY', 10, 0),
    ('DINNER', 'SAME_DAY', 10, 0)
ON CONFLICT ("mealType") DO NOTHING;

WITH inferred AS (
    SELECT
        "mealType",
        CASE
            WHEN (timezone('Asia/Tehran', "deadlineAt"))::date < "mealDate"
                THEN 'PREVIOUS_DAY'::"DeadlineDayRelation"
            ELSE 'SAME_DAY'::"DeadlineDayRelation"
        END AS relation,
        EXTRACT(HOUR FROM timezone('Asia/Tehran', "deadlineAt"))::integer AS hour,
        EXTRACT(MINUTE FROM timezone('Asia/Tehran', "deadlineAt"))::integer AS minute
    FROM "order_deadlines"
),
pattern AS (
    SELECT "mealType", relation, hour, minute
    FROM inferred
    GROUP BY "mealType", relation, hour, minute
),
uniform AS (
    SELECT "mealType"
    FROM pattern
    GROUP BY "mealType"
    HAVING COUNT(*) = 1
)
UPDATE "order_deadline_policies" AS policy
SET
    "relation" = pattern.relation,
    "hour" = pattern.hour,
    "minute" = pattern.minute
FROM pattern
INNER JOIN uniform ON uniform."mealType" = pattern."mealType"
WHERE policy."mealType" = pattern."mealType";
