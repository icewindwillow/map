-- Additive only. Also created automatically on the first authenticated editor save/upload.
CREATE TABLE IF NOT EXISTS map_places (
  id TEXT PRIMARY KEY, published TEXT, draft TEXT, revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL, updated_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS map_photos (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL
);
