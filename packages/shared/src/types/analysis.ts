/**
 * Analysis & scoring types for J33T Intel
 * These define the output of every analysis run.
 */

import type { TokenCA, Timestamp, TokenMetadata, DetectedBundle, DevWalletActivity, MarketSnapshot } from "./token.js";

/** All detection signals with their computed values */
export interface DetectionSignals {
  /** Liquidity growth rate (USD per minute since launch) */
  liquidityGrowthRate: number;
  /** Buy/sell ratio in first N minutes (>1 = more buys) */
  buySellRatio: number;
  /** Percentage of supply held by detected bundles */
  bundlePercentage: number;
  /** Number of detected bundles */
  bundleCount: number;
  /** Top 10 holder concentration (% of supply) */
  top10HolderPercentage: number;
  /** Dev wallet sold percentage */
  devSoldPercentage: number;
  /** Is liquidity locked? */
  liquidityLocked: boolean;
  /** Liquidity lock duration in hours (0 if not locked) */
  liquidityLockDurationHours: number;
  /** Volume to market cap ratio */
  volumeMcapRatio: number;
  /** Price momentum score (-1 to 1, positive = organic growth) */
  priceMomentumScore: number;
  /** Has freeze authority? */
  hasFreezeAuthority: boolean;
  /** Has mint authority? */
  hasMintAuthority: boolean;
  /** Transaction timing suspicion score (0-1, higher = more suspicious) */
  transactionTimingSuspicion: number;
  /** Unique wallets in first 10 minutes */
  uniqueWalletsFirst10Min: number;
}

/** Individual signal score with reasoning */
export interface SignalScore {
  signal: keyof DetectionSignals;
  /** Raw value from detection */
  rawValue: number | boolean;
  /** Normalized score 0-100 */
  normalizedScore: number;
  /** Weight applied to this signal */
  weight: number;
  /** Weighted contribution to final score */
  weightedScore: number;
  /** Human-readable explanation */
  reason: string;
}

/** Composite analysis scores */
export interface AnalysisScores {
  /** Overall potential score (0-100, higher = more promising) */
  potentialScore: number;
  /** Rugpull risk score (0-100, higher = more risky) */
  rugpullRiskScore: number;
  /** Confidence level of the analysis (0-100) */
  confidence: number;
  /** Individual signal breakdowns */
  signalBreakdown: SignalScore[];
}

/** Pattern classification */
export type PatternType = "positive" | "negative" | "unknown";

/** Optimal filter settings derived from backtesting */
export interface FilterSettings {
  /** Minimum liquidity at launch (USD) */
  minLiquidityUsd: number;
  /** Maximum bundle percentage */
  maxBundlePercentage: number;
  /** Minimum buy/sell ratio */
  minBuySellRatio: number;
  /** Maximum dev sold percentage */
  maxDevSoldPercentage: number;
  /** Maximum top 10 holder concentration */
  maxTop10HolderPercentage: number;
  /** Minimum unique wallets in first 10 min */
  minUniqueWallets10Min: number;
  /** Require liquidity lock? */
  requireLiquidityLock: boolean;
  /** Reject if freeze authority exists? */
  rejectFreezeAuthority: boolean;
  /** Reject if mint authority exists? */
  rejectMintAuthority: boolean;
  /** Maximum MCap at entry (USD) */
  maxEntryMcapUsd: number;
}

/** Complete analysis result — the main JSON output */
export interface AnalysisResult {
  /** Schema version for forward compatibility */
  schemaVersion: "0.1.0";
  /** Token being analyzed */
  tokenCA: TokenCA;
  /** When the analysis was performed */
  analyzedAt: Timestamp;
  /** Analysis duration in ms */
  analysisDurationMs: number;
  /** Token metadata */
  metadata: TokenMetadata;
  /** Pattern classification */
  patternType: PatternType;
  /** Market snapshot at analysis time */
  marketSnapshot: MarketSnapshot;
  /** Market snapshot at detected entry point (backtester) */
  entrySnapshot?: MarketSnapshot;
  /** All-time high market data (for positive patterns) */
  athSnapshot?: MarketSnapshot;
  /** Raw detection signals */
  signals: DetectionSignals;
  /** Computed scores */
  scores: AnalysisScores;
  /** Optimal filter settings (from backtester) */
  filterSettings?: FilterSettings;
  /** Detected bundles */
  bundles: DetectedBundle[];
  /** Dev wallet activity */
  devActivity: DevWalletActivity;
  /** Analysis mode that produced this result */
  mode: AnalysisMode;
  /** Detailed behavioral patterns for AI training */
  detailedPatterns?: any;
}

export type AnalysisMode = "backtester" | "rugpull_pattern" | "live_scan";

/** Submission to the central community database */
export interface CommunitySubmission {
  /** Analysis result (without raw transaction data) */
  tokenCA: TokenCA;
  analyzedAt: Timestamp;
  patternType: PatternType;
  signals: DetectionSignals;
  scores: AnalysisScores;
  filterSettings?: FilterSettings;
  /** MCap at entry and ATH for positive patterns */
  entryMcapUsd?: number;
  athMcapUsd?: number;
  /** Client version that produced this */
  clientVersion: string;
}
