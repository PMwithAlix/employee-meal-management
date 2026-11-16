CREATE OR REPLACE FUNCTION prevent_published_menu_item_mutation()
RETURNS trigger AS $$
DECLARE
  version_status "MenuVersionStatus";
  version_menu_id uuid;
  version_number integer;
  live_number integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT "status", "menuId", "versionNumber"
      INTO version_status, version_menu_id, version_number
      FROM "menu_versions"
      WHERE "id" = OLD."menuVersionId";
  ELSE
    SELECT "status", "menuId", "versionNumber"
      INTO version_status, version_menu_id, version_number
      FROM "menu_versions"
      WHERE "id" = NEW."menuVersionId";
  END IF;

  SELECT MAX("versionNumber")
    INTO live_number
    FROM "menu_versions"
    WHERE "menuId" = version_menu_id;

  -- Historical published copies stay frozen. The current live version is editable
  -- even if it was published under the previous publish workflow.
  IF version_status = 'PUBLISHED' AND version_number IS DISTINCT FROM live_number THEN
    RAISE EXCEPTION 'historical published menu versions are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
