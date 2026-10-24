-- No credentials, actor information or notification bodies are stored here.
CREATE TABLE IF NOT EXISTS item_operations (
  id TEXT PRIMARY KEY,
  spreadsheet TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'done')),
  response TEXT,
  status INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Serialize app mutations while their before/after snapshots are captured.
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_item_operation
  ON item_operations(spreadsheet) WHERE state = 'pending';
