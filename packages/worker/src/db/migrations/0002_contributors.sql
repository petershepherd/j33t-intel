CREATE TABLE IF NOT EXISTS contributors (
  hash TEXT PRIMARY KEY,
  total_submissions INTEGER NOT NULL DEFAULT 0,
  first_submission_at INTEGER,
  last_submission_at INTEGER,
  current_streak_days INTEGER NOT NULL DEFAULT 0,
  longest_streak_days INTEGER NOT NULL DEFAULT 0,
  streak_last_date TEXT,
  contributor_level TEXT NOT NULL DEFAULT 'none'
    CHECK (contributor_level IN ('none', 'contributor', 'active', 'power', 'diamond')),
  airdrop_eligible INTEGER NOT NULL DEFAULT 0,
  airdrop_multiplier REAL NOT NULL DEFAULT 0,
  daily_bonus_analyses INTEGER NOT NULL DEFAULT 0,
  pattern_library_access INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS contributor_daily_log (
  contributor_hash TEXT NOT NULL,
  date TEXT NOT NULL,
  submissions_count INTEGER NOT NULL DEFAULT 0,
  tokens_analyzed TEXT,
  PRIMARY KEY (contributor_hash, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_log_date ON contributor_daily_log(date);
CREATE INDEX IF NOT EXISTS idx_contributors_level ON contributors(contributor_level);
CREATE INDEX IF NOT EXISTS idx_contributors_streak ON contributors(current_streak_days DESC);
CREATE INDEX IF NOT EXISTS idx_contributors_airdrop ON contributors(airdrop_eligible, airdrop_multiplier DESC);
