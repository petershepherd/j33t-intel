-- J33T Intel Database Schema v0.1
-- Cloudflare D1 (SQLite)

-- Community submissions
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  token_ca TEXT NOT NULL,
  analyzed_at INTEGER NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('positive', 'negative', 'unknown')),

  -- Detection signals
  liquidity_growth_rate REAL,
  buy_sell_ratio REAL,
  bundle_percentage REAL,
  bundle_count INTEGER,
  top10_holder_percentage REAL,
  dev_sold_percentage REAL,
  liquidity_locked INTEGER,  -- boolean as 0/1
  liquidity_lock_duration_hours REAL,
  volume_mcap_ratio REAL,
  price_momentum_score REAL,
  has_freeze_authority INTEGER,  -- boolean as 0/1
  has_mint_authority INTEGER,  -- boolean as 0/1
  transaction_timing_suspicion REAL,
  unique_wallets_first_10min INTEGER,

  -- Scores
  potential_score INTEGER,
  rugpull_risk_score INTEGER,
  confidence INTEGER,

  -- Market data
  entry_mcap_usd REAL,
  ath_mcap_usd REAL,

  -- Filter settings (stored as JSON)
  filter_settings TEXT,

  -- Meta
  client_version TEXT NOT NULL,
  contributor_hash TEXT,  -- anonymized contributor identifier
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  -- Validation
  outlier_warnings TEXT,  -- JSON array of warnings
  is_validated INTEGER NOT NULL DEFAULT 0
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_token ON submissions(token_ca);
CREATE INDEX IF NOT EXISTS idx_submissions_pattern ON submissions(pattern_type);
CREATE INDEX IF NOT EXISTS idx_submissions_scores ON submissions(potential_score, rugpull_risk_score);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);

-- Daily analysis tracking per contributor
CREATE TABLE IF NOT EXISTS daily_usage (
  contributor_hash TEXT NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  analyses_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contributor_hash, date)
);

-- Aggregated pattern summaries (refreshed periodically)
CREATE TABLE IF NOT EXISTS pattern_summaries (
  token_ca TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  avg_potential_score REAL,
  avg_rugpull_risk_score REAL,
  submission_count INTEGER NOT NULL DEFAULT 0,
  avg_filter_settings TEXT,  -- JSON
  last_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patterns_type ON pattern_summaries(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_score ON pattern_summaries(avg_potential_score DESC);
