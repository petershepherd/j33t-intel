-- Detailed behavioral patterns for AI training
-- No wallet addresses stored — only anonymized behavioral data

CREATE TABLE IF NOT EXISTS submission_patterns (
  submission_id TEXT PRIMARY KEY,
  token_ca TEXT NOT NULL,

  -- First 5 minutes behavior
  first_5min_total_txs INTEGER DEFAULT 0,
  first_5min_buy_count INTEGER DEFAULT 0,
  first_5min_sell_count INTEGER DEFAULT 0,
  first_5min_unique_buyers INTEGER DEFAULT 0,
  first_5min_unique_sellers INTEGER DEFAULT 0,
  first_5min_total_sol_volume REAL DEFAULT 0,
  first_5min_avg_buy_size_sol REAL DEFAULT 0,
  first_5min_largest_buy_sol REAL DEFAULT 0,

  -- First 30 seconds (critical window for bundles)
  first_30s_buy_count INTEGER DEFAULT 0,
  first_30s_unique_buyers INTEGER DEFAULT 0,
  first_30s_total_sol REAL DEFAULT 0,
  first_30s_slots_used INTEGER DEFAULT 0,
  first_30s_max_buys_per_slot INTEGER DEFAULT 0,

  -- First 60 seconds
  first_60s_buy_count INTEGER DEFAULT 0,
  first_60s_unique_buyers INTEGER DEFAULT 0,
  first_60s_sell_count INTEGER DEFAULT 0,

  -- Bundle behavior details
  bundle_count INTEGER DEFAULT 0,
  bundle_total_wallets INTEGER DEFAULT 0,
  bundle_avg_wallets_per_bundle REAL DEFAULT 0,
  bundle_largest_wallet_count INTEGER DEFAULT 0,
  bundle_first_bundle_time_sec REAL DEFAULT 0,
  bundle_avg_buy_size_sol REAL DEFAULT 0,
  bundle_total_sol_spent REAL DEFAULT 0,
  bundle_slots_span INTEGER DEFAULT 0,
  bundle_pct_of_early_buys REAL DEFAULT 0,

  -- Dev wallet behavior timeline
  dev_first_action TEXT,
  dev_first_action_time_sec REAL DEFAULT 0,
  dev_first_sell_time_sec REAL,
  dev_sell_count_1h INTEGER DEFAULT 0,
  dev_sell_pct_1h REAL DEFAULT 0,
  dev_added_liquidity INTEGER DEFAULT 0,
  dev_removed_liquidity INTEGER DEFAULT 0,
  dev_remove_liq_time_sec REAL,

  -- Liquidity behavior
  liq_initial_sol REAL DEFAULT 0,
  liq_added_count_1h INTEGER DEFAULT 0,
  liq_removed_count_1h INTEGER DEFAULT 0,
  liq_removed_pct_1h REAL DEFAULT 0,
  liq_first_remove_time_sec REAL,

  -- Price action first hour
  price_at_1min REAL,
  price_at_5min REAL,
  price_at_15min REAL,
  price_at_30min REAL,
  price_at_60min REAL,
  price_peak_1h REAL,
  price_peak_time_sec REAL,
  price_drop_from_peak_pct REAL,
  mcap_at_1min REAL,
  mcap_at_5min REAL,
  mcap_at_peak REAL,

  -- Trading velocity
  buys_per_min_avg_5min REAL DEFAULT 0,
  buys_per_min_avg_30min REAL DEFAULT 0,
  sell_pressure_start_time_sec REAL,
  buy_sell_ratio_1min REAL,
  buy_sell_ratio_5min REAL,
  buy_sell_ratio_15min REAL,
  buy_sell_ratio_60min REAL,

  -- Organic vs bot indicators
  avg_time_between_buys_sec REAL DEFAULT 0,
  stddev_time_between_buys REAL DEFAULT 0,
  pct_buys_in_same_slot REAL DEFAULT 0,
  unique_buyer_return_rate REAL DEFAULT 0,

  -- Token metadata at analysis time
  has_freeze_authority INTEGER DEFAULT 0,
  has_mint_authority INTEGER DEFAULT 0,
  total_supply REAL,
  decimals INTEGER,

  -- Pattern classification
  pattern_type TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_patterns_token ON submission_patterns(token_ca);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON submission_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_created ON submission_patterns(created_at DESC);
