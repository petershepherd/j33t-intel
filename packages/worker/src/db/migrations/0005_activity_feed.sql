CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('submission', 'disputed', 'vote', 'level_up', 'streak')),
  contributor_hash TEXT NOT NULL,
  token_ca TEXT,
  details TEXT,
  trust_change REAL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(event_type);
