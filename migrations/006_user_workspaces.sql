CREATE TABLE IF NOT EXISTS user_workspaces (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  sheet_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
