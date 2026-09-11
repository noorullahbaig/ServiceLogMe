PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, profile_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stored_files (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  storage_driver TEXT NOT NULL DEFAULT 'D1' CHECK (storage_driver IN ('D1', 'R2')),
  object_key TEXT,
  content BLOB,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 450000),
  checksum TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES profiles(id),
  created_at TEXT NOT NULL,
  attached_at TEXT
);

ALTER TABLE photos ADD COLUMN file_id TEXT;
ALTER TABLE signatures ADD COLUMN file_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id, active);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_stored_files_org ON stored_files(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stored_files_orphans ON stored_files(attached_at, created_at);

CREATE TRIGGER IF NOT EXISTS service_notes_revision_guard
BEFORE UPDATE ON service_notes
WHEN OLD.status = 'COMPLETED' OR NEW.revision != OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'service note revision conflict or completed note is immutable');
END;

