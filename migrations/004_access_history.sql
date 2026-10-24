ALTER TABLE app_access ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE app_access ADD COLUMN invited_at TEXT;
ALTER TABLE app_access ADD COLUMN last_access_at TEXT;
ALTER TABLE app_access ADD COLUMN revoked_at TEXT;
ALTER TABLE app_access ADD COLUMN shared_sheet_id TEXT;
ALTER TABLE app_access ADD COLUMN drive_permission_id TEXT;
UPDATE app_access SET invited_at = created_at WHERE invited_at IS NULL;
