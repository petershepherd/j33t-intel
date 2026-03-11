CREATE TABLE IF NOT EXISTS intel_api_keys (
  key_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  tier_id TEXT NOT NULL DEFAULT 'street_stray',
  tier_name TEXT NOT NULL DEFAULT 'Street Stray',
  analyses_per_day INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_used_at INTEGER,
  last_balance_check INTEGER,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  contributor_level TEXT NOT NULL DEFAULT 'none'
);

CREATE INDEX IF NOT EXISTS idx_api_keys_wallet ON intel_api_keys(wallet_address);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked ON intel_api_keys(is_revoked);
