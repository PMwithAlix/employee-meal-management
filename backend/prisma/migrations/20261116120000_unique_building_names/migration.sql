UPDATE "buildings"
SET
  "name" = btrim(regexp_replace("name", '\s+', ' ', 'g')),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" <> btrim(regexp_replace("name", '\s+', ' ', 'g'));

WITH ranked AS (
  SELECT
    "id",
    "name",
    ROW_NUMBER() OVER (
      PARTITION BY LOWER("name")
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "buildings"
)
UPDATE "buildings" AS building
SET
  "name" = LEFT(ranked."name", 100) || ' · ' || LEFT(REPLACE(ranked."id"::text, '-', ''), 8),
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked
WHERE building."id" = ranked."id"
  AND ranked.rn > 1;

CREATE UNIQUE INDEX "buildings_name_key" ON "buildings"("name");
