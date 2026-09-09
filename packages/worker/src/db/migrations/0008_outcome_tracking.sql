CREATE TABLE IF NOT EXISTS tracked_tokens (
  address TEXT PRIMARY KEY,
  symbol TEXT,
  name TEXT,
  source TEXT NOT NULL,
  was_rejected INTEGER NOT NULL DEFAULT 0,
  reject_reason TEXT,
  filter_config TEXT,
  discovered_at INTEGER NOT NULL,
  pair_created_at INTEGER,
  call_age_min INTEGER,
  call_price REAL,
  call_mcap REAL,
  call_liq REAL,
  call_score INTEGER,
  call_buys INTEGER,
  call_sells INTEGER,
  ath_price REAL,
  ath_mcap REAL,
  ath_at INTEGER,
  ath_multiple REAL,
  max_liq REAL DEFAULT 0,
  last_price REAL,
  last_mcap REAL,
  last_liq REAL,
  last_sample_at INTEGER,
  next_sample_at INTEGER,
  sample_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  rug_liq_at INTEGER,
  rug_price_at INTEGER,
  rug_silence_at INTEGER,
  survived_7d INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  closed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tracked_due ON tracked_tokens(status, next_sample_at);
CREATE INDEX IF NOT EXISTS idx_tracked_rejected ON tracked_tokens(was_rejected, status);
CREATE INDEX IF NOT EXISTS idx_tracked_discovered ON tracked_tokens(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_source ON tracked_tokens(source);

CREATE TABLE IF NOT EXISTS token_samples (
  token_address TEXT NOT NULL,
  sampled_at INTEGER NOT NULL,
  minutes_since_call REAL,
  price REAL,
  mcap REAL,
  liquidity REAL,
  volume_h1 REAL,
  volume_h6 REAL,
  buys_h1 INTEGER,
  sells_h1 INTEGER,
  txns_h6 INTEGER,
  price_change_h1 REAL,
  PRIMARY KEY (token_address, sampled_at)
);

CREATE INDEX IF NOT EXISTS idx_samples_token ON token_samples(token_address, sampled_at);
