/**
 * Signal Extractor
 *
 * Takes parsed transactions, bundle data, dev wallet analysis,
 * and market data — and produces the full DetectionSignals object.
 *
 * This is the bridge between raw data and the scoring engine.
 */

import type {
  ParsedTransaction,
  DetectedBundle,
  DevWalletActivity,
  MarketSnapshot,
  TokenMetadata,
  DetectionSignals,
} from "@j33t-intel/shared";
import {
  getUniqueWalletsInWindow,
  calculateBuySellRatio,
} from "./transaction-parser.js";
import {
  calculateTotalBundlePercentage,
  calculateTimingSuspicion,
} from "./bundle-detector.js";

/** Input data needed to extract all signals */
export interface SignalExtractionInput {
  transactions: ParsedTransaction[];
  bundles: DetectedBundle[];
  devActivity: DevWalletActivity;
  metadata: TokenMetadata;
  marketSnapshot: MarketSnapshot;
  /** Token creation timestamp (ms) */
  tokenCreatedAt: number;
  /** Top 10 holder percentage (from on-chain data) */
  top10HolderPercentage: number;
  /** Is liquidity locked? */
  liquidityLocked: boolean;
  /** Liquidity lock duration in hours */
  liquidityLockDurationHours: number;
}

/**
 * Extract all detection signals from the input data.
 */
export function extractSignals(input: SignalExtractionInput): DetectionSignals {
  const {
    transactions,
    bundles,
    devActivity,
    metadata,
    marketSnapshot,
    tokenCreatedAt,
    top10HolderPercentage,
    liquidityLocked,
    liquidityLockDurationHours,
  } = input;

  // Time since launch
  const minutesSinceLaunch = Math.max(1, (Date.now() - tokenCreatedAt) / 60_000);

  // Liquidity growth rate (USD per minute)
  const liquidityGrowthRate = marketSnapshot.liquidityUsd / minutesSinceLaunch;

  // Buy/sell ratio in first 60 minutes
  const buySellRatio = calculateBuySellRatio(transactions, 60);

  // Bundle metrics
  const bundlePercentage = calculateTotalBundlePercentage(bundles);
  const bundleCount = bundles.length;

  // Volume / MCap ratio
  const volumeMcapRatio = marketSnapshot.mcapUsd > 0
    ? marketSnapshot.volumeUsd / marketSnapshot.mcapUsd
    : 0;

  // Price momentum score (-1 to 1)
  const priceMomentumScore = calculatePriceMomentum(transactions, tokenCreatedAt);

  // Transaction timing suspicion
  const transactionTimingSuspicion = calculateTimingSuspicion(transactions);

  // Unique wallets in first 10 minutes
  const uniqueWalletsFirst10Min = getUniqueWalletsInWindow(transactions, 10).size;

  return {
    liquidityGrowthRate,
    buySellRatio,
    bundlePercentage,
    bundleCount,
    top10HolderPercentage,
    devSoldPercentage: devActivity.soldPercentage,
    liquidityLocked,
    liquidityLockDurationHours,
    volumeMcapRatio,
    priceMomentumScore,
    hasFreezeAuthority: metadata.hasFreezeAuthority,
    hasMintAuthority: metadata.hasMintAuthority,
    transactionTimingSuspicion,
    uniqueWalletsFirst10Min,
  };
}

/**
 * Calculate price momentum score from transaction data.
 *
 * Organic growth: steady increase in SOL amounts per transaction over time.
 * Artificial pump: sudden spike in amounts followed by decline.
 *
 * Returns a value from -1 (artificial/declining) to 1 (organic growth).
 */
function calculatePriceMomentum(
  transactions: ParsedTransaction[],
  tokenCreatedAt: number,
): number {
  const buyTxs = transactions
    .filter((tx) => tx.type === "buy" && tx.solAmount > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (buyTxs.length < 5) return 0; // Not enough data

  // Split into time quartiles
  const duration = buyTxs[buyTxs.length - 1].timestamp - buyTxs[0].timestamp;
  if (duration < 60_000) return 0; // Less than 1 minute of data

  const quarterDuration = duration / 4;
  const quarters: number[][] = [[], [], [], []];

  for (const tx of buyTxs) {
    const elapsed = tx.timestamp - buyTxs[0].timestamp;
    const quarterIndex = Math.min(3, Math.floor(elapsed / quarterDuration));
    quarters[quarterIndex].push(tx.solAmount);
  }

  // Calculate average SOL per buy in each quarter
  const avgPerQuarter = quarters.map((q) =>
    q.length > 0 ? q.reduce((a, b) => a + b, 0) / q.length : 0,
  );

  // Check for organic growth pattern:
  // Each quarter should have similar or increasing average amounts
  let growthScore = 0;
  let comparisons = 0;

  for (let i = 1; i < avgPerQuarter.length; i++) {
    if (avgPerQuarter[i - 1] > 0 && avgPerQuarter[i] > 0) {
      const change = (avgPerQuarter[i] - avgPerQuarter[i - 1]) / avgPerQuarter[i - 1];
      // Moderate growth (10-200%) is organic
      if (change > 0 && change < 2) {
        growthScore += 0.5;
      } else if (change >= 2) {
        // Extreme spike — suspicious
        growthScore -= 0.3;
      } else if (change < -0.5) {
        // Sharp decline — dump after pump
        growthScore -= 0.5;
      }
      comparisons++;
    }
  }

  if (comparisons === 0) return 0;

  // Also factor in transaction count distribution (organic = spread out)
  const txCountPerQuarter = quarters.map((q) => q.length);
  const totalTxs = txCountPerQuarter.reduce((a, b) => a + b, 0);
  const evenDistribution = totalTxs / 4;

  let distributionScore = 0;
  for (const count of txCountPerQuarter) {
    if (count > 0) {
      const deviation = Math.abs(count - evenDistribution) / evenDistribution;
      distributionScore += deviation < 0.5 ? 0.15 : -0.1;
    }
  }

  const raw = (growthScore / comparisons) + distributionScore;
  return Math.max(-1, Math.min(1, raw));
}
