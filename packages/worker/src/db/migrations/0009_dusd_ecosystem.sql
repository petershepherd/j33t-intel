CREATE TABLE IF NOT EXISTS dusd_markets (
  mint TEXT PRIMARY KEY, symbol TEXT, name TEXT, description TEXT,
  creator TEXT, creator_profile TEXT,
  pool_address TEXT, damm_pool_address TEXT, config_address TEXT, fee_vault_address TEXT,
  fee_version INTEGER, creator_routing_mode TEXT, creator_routing_immutable INTEGER,
  graduation_threshold_dusd REAL, supply_total REAL, supply_curve REAL, supply_graduation REAL,
  website_url TEXT, x_url TEXT, image_url TEXT,
  created_at INTEGER, first_seen_at INTEGER NOT NULL, status TEXT,
  graduated_at INTEGER, migration_status TEXT,
  last_price_dusd REAL, last_price_usd REAL, last_mcap_dusd REAL, last_mcap_usd REAL,
  last_quote_reserve_dusd REAL, last_volume24h_dusd REAL, last_progress_bps INTEGER,
  last_sample_at INTEGER, next_sample_at INTEGER, sample_count INTEGER NOT NULL DEFAULT 0,
  ath_price_dusd REAL, ath_mcap_dusd REAL, ath_at INTEGER, max_progress_bps INTEGER DEFAULT 0,
  raw_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_dusd_status ON dusd_markets(status);
CREATE INDEX IF NOT EXISTS idx_dusd_due ON dusd_markets(next_sample_at);
CREATE INDEX IF NOT EXISTS idx_dusd_created ON dusd_markets(created_at DESC);

CREATE TABLE IF NOT EXISTS dusd_market_snapshots (
  mint TEXT NOT NULL, sampled_at INTEGER NOT NULL, minutes_since_launch REAL,
  dusd_price_usd REAL, price_dusd REAL, price_usd REAL, mcap_dusd REAL, mcap_usd REAL,
  quote_reserve_dusd REAL, volume24h_dusd REAL,
  graduation_progress_bps INTEGER, graduation_remaining_dusd REAL,
  perf_1h_pct REAL, perf_24h_pct REAL, perf_since_launch_pct REAL,
  creator_earned_dusd REAL, creator_claimed_dusd REAL,
  burns_24h_dusd REAL, burns_7d_dusd REAL, burns_30d_dusd REAL, market_boost_dusd REAL,
  status TEXT, migration_status TEXT, permanent_lock_verified INTEGER,
  raw_json TEXT, PRIMARY KEY (mint, sampled_at)
);
CREATE INDEX IF NOT EXISTS idx_dusd_snap ON dusd_market_snapshots(mint, sampled_at);

CREATE TABLE IF NOT EXISTS dusd_protocol_snapshots (
  captured_at INTEGER PRIMARY KEY, as_of_hour_ts INTEGER, price_usd REAL,
  current_supply REAL, total_burned REAL, burned_pct REAL, burned_value_usd REAL, raw_json TEXT
);
