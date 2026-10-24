CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  spreadsheet TEXT NOT NULL,
  actor_sub TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS activity_logs_spreadsheet_time
  ON activity_logs(spreadsheet, created_at DESC);
