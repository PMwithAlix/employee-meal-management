-- One live monthly menu: the highest versionNumber is the source of truth.
-- Historical versions and menu items stay in place so order snapshots remain valid.
-- publishedVersionId is a leftover pointer and must reference a PUBLISHED version
-- because menus_published_version_guard rejects DRAFT targets.

UPDATE "menu_versions" AS version
SET
  "status" = 'PUBLISHED',
  "publishedAt" = COALESCE(version."publishedAt", NOW())
WHERE version."versionNumber" = (
  SELECT MAX(other."versionNumber")
  FROM "menu_versions" AS other
  WHERE other."menuId" = version."menuId"
)
AND version."status" = 'DRAFT';

UPDATE "menus" AS menu
SET "publishedVersionId" = live.id
FROM (
  SELECT DISTINCT ON ("menuId")
    "id",
    "menuId"
  FROM "menu_versions"
  ORDER BY "menuId", "versionNumber" DESC
) AS live
WHERE live."menuId" = menu."id"
  AND menu."publishedVersionId" IS DISTINCT FROM live.id;

CREATE OR REPLACE FUNCTION prevent_published_menu_item_mutation()
RETURNS trigger AS $$
DECLARE
  version_menu_id uuid;
  version_number integer;
  live_number integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT "menuId", "versionNumber"
      INTO version_menu_id, version_number
      FROM "menu_versions"
      WHERE "id" = OLD."menuVersionId";
  ELSE
    SELECT "menuId", "versionNumber"
      INTO version_menu_id, version_number
      FROM "menu_versions"
      WHERE "id" = NEW."menuVersionId";
  END IF;

  SELECT MAX("versionNumber")
    INTO live_number
    FROM "menu_versions"
    WHERE "menuId" = version_menu_id;

  IF version_number IS DISTINCT FROM live_number THEN
    RAISE EXCEPTION 'historical menu versions are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
