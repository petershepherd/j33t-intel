/**
 * Database Helper Layer
 *
 * All D1 queries go through here. This keeps the route handlers
 * clean and makes it easy to swap the DB later if needed.
 */

import type { CommunitySubmission, FilterSettings, PatternType } from "@j33t-intel/shared";
import { validateSubmission, detectOutliers } from "@j33t-intel/shared";

/** Generate a unique ID for submissions */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `sub_${timestamp}_${random}`;
}

/** Get today's date as YYYY-MM-DD string */
function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Submissions ──────────────────────────────────────────

export interface InsertSubmissionResult {
  id: string;
  accepted: boolean;
  rejectionReason?: string;
}

/**
 * Insert a new community submission.
 * Validates, checks for duplicates, runs outlier detection, then inserts.
 */
export async function insertSubmission(
  db: D1Database,
  submission: CommunitySubmission,
  contributorHash?: string,
): Promise<InsertSubmissionResult> {
  // 1. Validate
  const validation = validateSubmission(submission);
  if (!validation.valid) {
    return {
      id: "",
      accepted: false,
      rejectionReason: `Validation failed: ${validation.errors.join(", ")}`,
    };
  }

  // 2. Check for duplicates (same token + same contributor within 1 hour)
  if (contributorHash) {
    const oneHourAgo = Date.now() - 3_600_000;
    const duplicate = await db
      .prepare(
        "SELECT id FROM submissions WHERE token_ca = ? AND contributor_hash = ? AND created_at > ?",
      )
      .bind(submission.tokenCA, contributorHash, oneHourAgo)
      .first();

    if (duplicate) {
      return {
        id: "",
        accepted: false,
        rejectionReason: "Duplicate submission — same token analyzed within the last hour",
      };
    }
  }

  // 3. Outlier detection
  const outlierWarnings = detectOutliers(submission.signals);

  // 4. Insert
  const id = generateId();
  const s = submission.signals;
  const sc = submission.scores;

  await db
    .prepare(
      `INSERT INTO submissions (
        id, token_ca, analyzed_at, pattern_type,
        liquidity_growth_rate, buy_sell_ratio, bundle_percentage, bundle_count,
        top10_holder_percentage, dev_sold_percentage, liquidity_locked,
        liquidity_lock_duration_hours, volume_mcap_ratio, price_momentum_score,
        has_freeze_authority, has_mint_authority, transaction_timing_suspicion,
        unique_wallets_first_10min,
        potential_score, rugpull_risk_score, confidence,
        entry_mcap_usd, ath_mcap_usd, filter_settings,
        client_version, contributor_hash, outlier_warnings
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )`,
    )
    .bind(
      id,
      submission.tokenCA,
      submission.analyzedAt,
      submission.patternType,
      s.liquidityGrowthRate,
      s.buySellRatio,
      s.bundlePercentage,
      s.bundleCount,
      s.top10HolderPercentage,
      s.devSoldPercentage,
      s.liquidityLocked ? 1 : 0,
      s.liquidityLockDurationHours,
      s.volumeMcapRatio,
      s.priceMomentumScore,
      s.hasFreezeAuthority ? 1 : 0,
      s.hasMintAuthority ? 1 : 0,
      s.transactionTimingSuspicion,
      s.uniqueWalletsFirst10Min,
      sc.potentialScore,
      sc.rugpullRiskScore,
      sc.confidence,
      submission.entryMcapUsd ?? null,
      submission.athMcapUsd ?? null,
      submission.filterSettings ? JSON.stringify(submission.filterSettings) : null,
      submission.clientVersion,
      contributorHash ?? null,
      outlierWarnings.length > 0 ? JSON.stringify(outlierWarnings) : null,
    )
    .run();

  // 5. Update daily usage counter
  if (contributorHash) {
    await db
      .prepare(
        `INSERT INTO daily_usage (contributor_hash, date, analyses_count)
         VALUES (?, ?, 1)
         ON CONFLICT (contributor_hash, date)
         DO UPDATE SET analyses_count = analyses_count + 1`,
      )
      .bind(contributorHash, todayString())
      .run();
  }

  // 6. Update pattern summary (upsert)
  await refreshPatternSummary(db, submission.tokenCA);

  return { id, accepted: true };
}

/**
 * Get a submission by ID.
 */
export async function getSubmission(
  db: D1Database,
  id: string,
): Promise<Record<string, unknown> | null> {
  return await db
    .prepare("SELECT * FROM submissions WHERE id = ?")
    .bind(id)
    .first();
}

// ─── Pattern Summaries ────────────────────────────────────

export interface PatternSummaryRow {
  token_ca: string;
  pattern_type: string;
  avg_potential_score: number;
  avg_rugpull_risk_score: number;
  submission_count: number;
  avg_filter_settings: string | null;
  last_updated: number;
}

/**
 * Get community patterns with filtering and pagination.
 */
export async function getPatterns(
  db: D1Database,
  options: {
    patternType?: PatternType;
    sortBy?: "potential" | "risk" | "submissions" | "recent";
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ patterns: PatternSummaryRow[]; total: number }> {
  const limit = Math.min(options.limit ?? 20, 100);
  const offset = options.offset ?? 0;

  let whereClause = "";
  const params: unknown[] = [];

  if (options.patternType) {
    whereClause = "WHERE pattern_type = ?";
    params.push(options.patternType);
  }

  // Sort order
  let orderClause: string;
  switch (options.sortBy) {
    case "risk":
      orderClause = "ORDER BY avg_rugpull_risk_score DESC";
      break;
    case "submissions":
      orderClause = "ORDER BY submission_count DESC";
      break;
    case "recent":
      orderClause = "ORDER BY last_updated DESC";
      break;
    case "potential":
    default:
      orderClause = "ORDER BY avg_potential_score DESC";
      break;
  }

  // Count total
  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM pattern_summaries ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = countResult?.total ?? 0;

  // Fetch page
  const rows = await db
    .prepare(
      `SELECT * FROM pattern_summaries ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all<PatternSummaryRow>();

  return {
    patterns: rows.results ?? [],
    total,
  };
}

/**
 * Get the top rugpull patterns (for the public leaderboard).
 */
export async function getTopRugpullPatterns(
  db: D1Database,
  limit = 10,
): Promise<PatternSummaryRow[]> {
  const rows = await db
    .prepare(
      `SELECT * FROM pattern_summaries
       WHERE pattern_type = 'negative'
       ORDER BY avg_rugpull_risk_score DESC, submission_count DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<PatternSummaryRow>();

  return rows.results ?? [];
}

/**
 * Refresh the pattern summary for a specific token.
 * Aggregates all submissions for that token into a single summary row.
 */
async function refreshPatternSummary(
  db: D1Database,
  tokenCA: string,
): Promise<void> {
  const agg = await db
    .prepare(
      `SELECT
        token_ca,
        -- Most common pattern type wins
        (SELECT pattern_type FROM submissions WHERE token_ca = ? GROUP BY pattern_type ORDER BY COUNT(*) DESC LIMIT 1) as pattern_type,
        AVG(potential_score) as avg_potential_score,
        AVG(rugpull_risk_score) as avg_rugpull_risk_score,
        COUNT(*) as submission_count
       FROM submissions
       WHERE token_ca = ?`,
    )
    .bind(tokenCA, tokenCA)
    .first<{
      token_ca: string;
      pattern_type: string;
      avg_potential_score: number;
      avg_rugpull_risk_score: number;
      submission_count: number;
    }>();

  if (!agg || agg.submission_count === 0) return;

  // Calculate average filter settings from all submissions for this token
  const filterRows = await db
    .prepare(
      "SELECT filter_settings FROM submissions WHERE token_ca = ? AND filter_settings IS NOT NULL",
    )
    .bind(tokenCA)
    .all<{ filter_settings: string }>();

  let avgFilterSettings: string | null = null;

  if (filterRows.results && filterRows.results.length > 0) {
    avgFilterSettings = JSON.stringify(
      averageFilterSettings(
        filterRows.results
          .map((r) => {
            try { return JSON.parse(r.filter_settings) as FilterSettings; }
            catch { return null; }
          })
          .filter((f): f is FilterSettings => f !== null),
      ),
    );
  }

  await db
    .prepare(
      `INSERT INTO pattern_summaries (
        token_ca, pattern_type, avg_potential_score, avg_rugpull_risk_score,
        submission_count, avg_filter_settings, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (token_ca) DO UPDATE SET
        pattern_type = excluded.pattern_type,
        avg_potential_score = excluded.avg_potential_score,
        avg_rugpull_risk_score = excluded.avg_rugpull_risk_score,
        submission_count = excluded.submission_count,
        avg_filter_settings = excluded.avg_filter_settings,
        last_updated = excluded.last_updated`,
    )
    .bind(
      tokenCA,
      agg.pattern_type,
      Math.round(agg.avg_potential_score),
      Math.round(agg.avg_rugpull_risk_score),
      agg.submission_count,
      avgFilterSettings,
      Date.now(),
    )
    .run();
}

/**
 * Calculate average filter settings from multiple submissions.
 */
function averageFilterSettings(settings: FilterSettings[]): FilterSettings {
  if (settings.length === 0) {
    return {
      minLiquidityUsd: 1000,
      maxBundlePercentage: 15,
      minBuySellRatio: 1.5,
      maxDevSoldPercentage: 10,
      maxTop10HolderPercentage: 40,
      minUniqueWallets10Min: 10,
      requireLiquidityLock: false,
      rejectFreezeAuthority: true,
      rejectMintAuthority: true,
      maxEntryMcapUsd: 100_000,
    };
  }

  const n = settings.length;
  const avg = (fn: (s: FilterSettings) => number) =>
    settings.reduce((sum, s) => sum + fn(s), 0) / n;
  const majority = (fn: (s: FilterSettings) => boolean) =>
    settings.filter(fn).length > n / 2;

  return {
    minLiquidityUsd: Math.round(avg((s) => s.minLiquidityUsd)),
    maxBundlePercentage: Math.round(avg((s) => s.maxBundlePercentage) * 10) / 10,
    minBuySellRatio: Math.round(avg((s) => s.minBuySellRatio) * 100) / 100,
    maxDevSoldPercentage: Math.round(avg((s) => s.maxDevSoldPercentage) * 10) / 10,
    maxTop10HolderPercentage: Math.round(avg((s) => s.maxTop10HolderPercentage) * 10) / 10,
    minUniqueWallets10Min: Math.round(avg((s) => s.minUniqueWallets10Min)),
    requireLiquidityLock: majority((s) => s.requireLiquidityLock),
    rejectFreezeAuthority: majority((s) => s.rejectFreezeAuthority),
    rejectMintAuthority: majority((s) => s.rejectMintAuthority),
    maxEntryMcapUsd: Math.round(avg((s) => s.maxEntryMcapUsd)),
  };
}

// ─── Leaderboard ──────────────────────────────────────────

export interface LeaderboardRow {
  contributor_hash: string;
  submission_count: number;
  avg_confidence: number;
  first_submission: number;
  last_submission: number;
}

/**
 * Get the community contribution leaderboard.
 */
export async function getLeaderboard(
  db: D1Database,
  limit = 25,
): Promise<{ entries: LeaderboardRow[]; totalContributors: number }> {
  const countResult = await db
    .prepare("SELECT COUNT(DISTINCT contributor_hash) as total FROM submissions WHERE contributor_hash IS NOT NULL")
    .first<{ total: number }>();

  const totalContributors = countResult?.total ?? 0;

  const rows = await db
    .prepare(
      `SELECT
        contributor_hash,
        COUNT(*) as submission_count,
        AVG(confidence) as avg_confidence,
        MIN(created_at) as first_submission,
        MAX(created_at) as last_submission
       FROM submissions
       WHERE contributor_hash IS NOT NULL
       GROUP BY contributor_hash
       ORDER BY submission_count DESC, avg_confidence DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<LeaderboardRow>();

  return {
    entries: rows.results ?? [],
    totalContributors,
  };
}

// ─── Daily Usage ──────────────────────────────────────────

/**
 * Get today's analysis count for a contributor.
 */
export async function getDailyUsage(
  db: D1Database,
  contributorHash: string,
): Promise<number> {
  const row = await db
    .prepare(
      "SELECT analyses_count FROM daily_usage WHERE contributor_hash = ? AND date = ?",
    )
    .bind(contributorHash, todayString())
    .first<{ analyses_count: number }>();

  return row?.analyses_count ?? 0;
}

// ─── Stats ────────────────────────────────────────────────

export interface DbStats {
  totalSubmissions: number;
  totalTokens: number;
  totalContributors: number;
  positivePatterns: number;
  negativePatterns: number;
  submissionsToday: number;
}

/**
 * Get aggregate database statistics.
 */
export async function getStats(db: D1Database): Promise<DbStats> {
  const result = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM submissions) as total_submissions,
        (SELECT COUNT(DISTINCT token_ca) FROM submissions) as total_tokens,
        (SELECT COUNT(DISTINCT contributor_hash) FROM submissions WHERE contributor_hash IS NOT NULL) as total_contributors,
        (SELECT COUNT(*) FROM pattern_summaries WHERE pattern_type = 'positive') as positive_patterns,
        (SELECT COUNT(*) FROM pattern_summaries WHERE pattern_type = 'negative') as negative_patterns,
        (SELECT COUNT(*) FROM submissions WHERE created_at > ?) as submissions_today`,
    )
    .bind(Date.now() - 86_400_000)
    .first<{
      total_submissions: number;
      total_tokens: number;
      total_contributors: number;
      positive_patterns: number;
      negative_patterns: number;
      submissions_today: number;
    }>();

  return {
    totalSubmissions: result?.total_submissions ?? 0,
    totalTokens: result?.total_tokens ?? 0,
    totalContributors: result?.total_contributors ?? 0,
    positivePatterns: result?.positive_patterns ?? 0,
    negativePatterns: result?.negative_patterns ?? 0,
    submissionsToday: result?.submissions_today ?? 0,
  };
}

export async function insertPatterns(
  db: D1Database,
  submissionId: string,
  tokenCA: string,
  patterns: Record<string, unknown>,
  patternType: string,
): Promise<void> {
  const p = patterns;
  await db
    .prepare(
      `INSERT INTO submission_patterns (
        submission_id, token_ca,
        first_5min_total_txs, first_5min_buy_count, first_5min_sell_count,
        first_5min_unique_buyers, first_5min_unique_sellers, first_5min_total_sol_volume,
        first_5min_avg_buy_size_sol, first_5min_largest_buy_sol,
        first_30s_buy_count, first_30s_unique_buyers, first_30s_total_sol,
        first_30s_slots_used, first_30s_max_buys_per_slot,
        first_60s_buy_count, first_60s_unique_buyers, first_60s_sell_count,
        bundle_count, bundle_total_wallets, bundle_avg_wallets_per_bundle,
        bundle_largest_wallet_count, bundle_first_bundle_time_sec,
        bundle_avg_buy_size_sol, bundle_total_sol_spent, bundle_slots_span,
        bundle_pct_of_early_buys,
        dev_first_action, dev_first_action_time_sec, dev_first_sell_time_sec,
        dev_sell_count_1h, dev_sell_pct_1h, dev_added_liquidity,
        dev_removed_liquidity, dev_remove_liq_time_sec,
        liq_initial_sol, liq_added_count_1h, liq_removed_count_1h,
        liq_removed_pct_1h, liq_first_remove_time_sec,
        buys_per_min_avg_5min, buys_per_min_avg_30min,
        sell_pressure_start_time_sec,
        buy_sell_ratio_1min, buy_sell_ratio_5min,
        buy_sell_ratio_15min, buy_sell_ratio_60min,
        avg_time_between_buys_sec, stddev_time_between_buys,
        pct_buys_in_same_slot, unique_buyer_return_rate,
        has_freeze_authority, has_mint_authority,
        pattern_type, created_at
      ) VALUES (
        ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?
      )`)
    .bind(
      submissionId, tokenCA,
      p.first_5min_total_txs ?? 0, p.first_5min_buy_count ?? 0, p.first_5min_sell_count ?? 0,
      p.first_5min_unique_buyers ?? 0, p.first_5min_unique_sellers ?? 0, p.first_5min_total_sol_volume ?? 0,
      p.first_5min_avg_buy_size_sol ?? 0, p.first_5min_largest_buy_sol ?? 0,
      p.first_30s_buy_count ?? 0, p.first_30s_unique_buyers ?? 0, p.first_30s_total_sol ?? 0,
      p.first_30s_slots_used ?? 0, p.first_30s_max_buys_per_slot ?? 0,
      p.first_60s_buy_count ?? 0, p.first_60s_unique_buyers ?? 0, p.first_60s_sell_count ?? 0,
      p.bundle_count ?? 0, p.bundle_total_wallets ?? 0, p.bundle_avg_wallets_per_bundle ?? 0,
      p.bundle_largest_wallet_count ?? 0, p.bundle_first_bundle_time_sec ?? 0,
      p.bundle_avg_buy_size_sol ?? 0, p.bundle_total_sol_spent ?? 0, p.bundle_slots_span ?? 0,
      p.bundle_pct_of_early_buys ?? 0,
      p.dev_first_action ?? null, p.dev_first_action_time_sec ?? 0, p.dev_first_sell_time_sec ?? null,
      p.dev_sell_count_1h ?? 0, p.dev_sell_pct_1h ?? 0, p.dev_added_liquidity ?? 0,
      p.dev_removed_liquidity ?? 0, p.dev_remove_liq_time_sec ?? null,
      p.liq_initial_sol ?? 0, p.liq_added_count_1h ?? 0, p.liq_removed_count_1h ?? 0,
      p.liq_removed_pct_1h ?? 0, p.liq_first_remove_time_sec ?? null,
      p.buys_per_min_avg_5min ?? 0, p.buys_per_min_avg_30min ?? 0,
      p.sell_pressure_start_time_sec ?? null,
      p.buy_sell_ratio_1min ?? 0, p.buy_sell_ratio_5min ?? 0,
      p.buy_sell_ratio_15min ?? 0, p.buy_sell_ratio_60min ?? 0,
      p.avg_time_between_buys_sec ?? 0, p.stddev_time_between_buys ?? 0,
      p.pct_buys_in_same_slot ?? 0, p.unique_buyer_return_rate ?? 0,
      p.has_freeze_authority ?? 0, p.has_mint_authority ?? 0,
      patternType, Date.now(),
    )
    .run();
}
