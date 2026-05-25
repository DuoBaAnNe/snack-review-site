-- Add columns for base64 image storage (if they don't exist yet)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we ignore errors
-- Turso supports ALTER TABLE ADD COLUMN

-- Drop the old table if it has wrong schema (safe since no real data yet)
DROP TABLE IF EXISTS snack_images;

CREATE TABLE IF NOT EXISTS snack_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snack_id INTEGER REFERENCES snacks(id) ON DELETE CASCADE,
    filename TEXT NOT NULL DEFAULT '',
    original_name TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
