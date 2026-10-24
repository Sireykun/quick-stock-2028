CREATE TABLE IF NOT EXISTS asset_lifecycle (
  spreadsheet TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  custodian TEXT,
  checked_out_at TEXT,
  due_at TEXT,
  maintenance_status TEXT NOT NULL DEFAULT 'working',
  maintenance_note TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (spreadsheet, asset_key)
);
CREATE TABLE IF NOT EXISTS asset_lifecycle_events (
  id TEXT PRIMARY KEY,
  spreadsheet TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  person TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_asset_lifecycle_events_asset ON asset_lifecycle_events(spreadsheet, asset_key, created_at);
