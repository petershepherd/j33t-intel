/**
 * Bundle Detector
 *
 * Identifies coordinated wallet activity:
 * - Wallets funded from the same source
 * - Wallets buying in the same block/slot
 * - Wallets with suspiciously similar timing patterns
 *
 * A "bundle" is a group of wallets that appear to be controlled
 * by the same entity, typically used to accumulate a large position
 * while appearing as organic buying.
 */

import type { ParsedTransaction, DetectedBundle, TokenCA } from "@j33t-intel/shared";
import type { HeliusTransaction } from "../services/helius.js";
import { HeliusService } from "../services/helius.js";

/** Configuration for bundle detection sensitivity */
export interface BundleDetectionConfig {
  /** Maximum time window (ms) for transactions to be considered "same block" */
  sameBlockWindowMs: number;
  /** Minimum number of wallets to constitute a bundle */
  minBundleSize: number;
  /** Maximum time between first and last buy in a bundle (ms) */
  maxBundleSpreadMs: number;
  /** Consider wallets buying within N slots of each other as suspicious */
  slotProximityThreshold: number;
}

export const DEFAULT_BUNDLE_CONFIG: BundleDetectionConfig = {
  sameBlockWindowMs: 2_000,      // 2 seconds (roughly 4 Solana slots)
  minBundleSize: 2,              // At least 2 wallets
  maxBundleSpreadMs: 30_000,     // 30 seconds
  slotProximityThreshold: 5,     // Within 5 slots
};

/**
 * Detect bundles from parsed transactions.
 * Uses multiple heuristics to identify coordinated buying.
 */
export function detectBundles(
  transactions: ParsedTransaction[],
  totalSupply: number,
  config: BundleDetectionConfig = DEFAULT_BUNDLE_CONFIG,
): DetectedBundle[] {
  const buyTxs = transactions.filter((tx) => tx.type === "buy");

  if (buyTxs.length < config.minBundleSize) {
    return [];
  }

  const bundles: DetectedBundle[] = [];
  const assignedWallets = new Set<string>();
  let bundleIdCounter = 0;

  // Strategy 1: Same-slot clustering
  const slotBundles = detectSameSlotBundles(buyTxs, config);
  for (const walletGroup of slotBundles) {
    if (walletGroup.length >= config.minBundleSize) {
      const wallets = [...new Set(walletGroup.map((tx) => tx.signer))];

      // Skip if all transactions are from the same wallet (that's just one person buying multiple times)
      if (wallets.length < config.minBundleSize) continue;

      // Skip wallets already assigned to a bundle
      const newWallets = wallets.filter((w) => !assignedWallets.has(w));
      if (newWallets.length < config.minBundleSize) continue;

      const bundleTxs = buyTxs.filter((tx) => newWallets.includes(tx.signer));
      const totalTokens = bundleTxs.reduce((sum, tx) => sum + tx.tokenAmount, 0);

      bundles.push({
        id: `bundle_${++bundleIdCounter}`,
        wallets: newWallets,
        totalTokensBought: totalTokens,
        supplyPercentage: totalSupply > 0 ? (totalTokens / totalSupply) * 100 : 0,
        transactions: bundleTxs,
      });

      newWallets.forEach((w) => assignedWallets.add(w));
    }
  }

  // Strategy 2: Time-proximity clustering
  const timeBundles = detectTimeProximityBundles(buyTxs, config);
  for (const walletGroup of timeBundles) {
    const wallets = [...new Set(walletGroup.map((tx) => tx.signer))];
    const newWallets = wallets.filter((w) => !assignedWallets.has(w));

    if (newWallets.length < config.minBundleSize) continue;

    const bundleTxs = buyTxs.filter((tx) => newWallets.includes(tx.signer));
    const totalTokens = bundleTxs.reduce((sum, tx) => sum + tx.tokenAmount, 0);

    bundles.push({
      id: `bundle_${++bundleIdCounter}`,
      wallets: newWallets,
      totalTokensBought: totalTokens,
      supplyPercentage: totalSupply > 0 ? (totalTokens / totalSupply) * 100 : 0,
      transactions: bundleTxs,
    });

    newWallets.forEach((w) => assignedWallets.add(w));
  }

  return bundles;
}

/**
 * Strategy 1: Find wallets buying in the exact same slot or within a few slots.
 * This is the strongest bundle signal — on Solana, transactions in the same
 * slot were likely submitted together.
 */
function detectSameSlotBundles(
  buyTxs: ParsedTransaction[],
  config: BundleDetectionConfig,
): ParsedTransaction[][] {
  // Group by slot (with proximity tolerance)
  const slotGroups = new Map<number, ParsedTransaction[]>();

  for (const tx of buyTxs) {
    // Find if there's an existing group within slot proximity
    let assigned = false;
    for (const [slot, group] of slotGroups) {
      if (Math.abs(tx.slot - slot) <= config.slotProximityThreshold) {
        group.push(tx);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      slotGroups.set(tx.slot, [tx]);
    }
  }

  // Return groups with multiple unique wallets
  return [...slotGroups.values()].filter((group) => {
    const uniqueWallets = new Set(group.map((tx) => tx.signer));
    return uniqueWallets.size >= config.minBundleSize;
  });
}

/**
 * Strategy 2: Find clusters of different wallets buying within a tight time window.
 * This catches bundles that span a few blocks but are still clearly coordinated.
 */
function detectTimeProximityBundles(
  buyTxs: ParsedTransaction[],
  config: BundleDetectionConfig,
): ParsedTransaction[][] {
  const sorted = [...buyTxs].sort((a, b) => a.timestamp - b.timestamp);
  const clusters: ParsedTransaction[][] = [];
  let currentCluster: ParsedTransaction[] = [];

  for (const tx of sorted) {
    if (currentCluster.length === 0) {
      currentCluster.push(tx);
      continue;
    }

    const firstInCluster = currentCluster[0];
    const timeDiff = tx.timestamp - firstInCluster.timestamp;

    if (timeDiff <= config.maxBundleSpreadMs) {
      currentCluster.push(tx);
    } else {
      // Check if current cluster is a valid bundle
      if (currentCluster.length >= config.minBundleSize) {
        const uniqueWallets = new Set(currentCluster.map((t) => t.signer));
        if (uniqueWallets.size >= config.minBundleSize) {
          clusters.push([...currentCluster]);
        }
      }
      currentCluster = [tx];
    }
  }

  // Don't forget the last cluster
  if (currentCluster.length >= config.minBundleSize) {
    const uniqueWallets = new Set(currentCluster.map((t) => t.signer));
    if (uniqueWallets.size >= config.minBundleSize) {
      clusters.push(currentCluster);
    }
  }

  return clusters;
}

/**
 * Try to find common funding sources for a set of wallets.
 * This is the most expensive operation — requires additional Helius API calls.
 *
 * Optional: only run when deeper investigation is needed.
 */
export async function findCommonFunding(
  wallets: string[],
  helius: HeliusService,
): Promise<string | undefined> {
  // For each wallet, get its first few incoming SOL transactions
  const fundingSources = new Map<string, number>(); // source -> count

  for (const wallet of wallets.slice(0, 10)) { // Limit to 10 wallets to save API calls
    try {
      const sigs = await helius.getSignaturesForAddress(wallet, 10);

      if (sigs.length > 0) {
        // The earliest signatures are likely funding transactions
        const earliestSigs = sigs.slice(-3); // Last 3 = earliest chronologically

        const txs = await helius.parseTransactions(
          earliestSigs.map((s) => s.signature),
        );

        for (const tx of txs) {
          for (const transfer of tx.nativeTransfers ?? []) {
            if (
              transfer.toUserAccount === wallet &&
              transfer.amount > 1_000_000 // > 0.001 SOL
            ) {
              const source = transfer.fromUserAccount;
              fundingSources.set(source, (fundingSources.get(source) ?? 0) + 1);
            }
          }
        }
      }
    } catch {
      // Skip wallets that fail — don't break the whole analysis
      continue;
    }
  }

  // Find the most common funding source
  let maxCount = 0;
  let commonSource: string | undefined;

  for (const [source, count] of fundingSources) {
    if (count > maxCount && count >= 2) { // At least 2 wallets funded from same source
      maxCount = count;
      commonSource = source;
    }
  }

  return commonSource;
}

/**
 * Calculate the total bundle percentage from all detected bundles.
 */
export function calculateTotalBundlePercentage(bundles: DetectedBundle[]): number {
  return bundles.reduce((sum, b) => sum + b.supplyPercentage, 0);
}

/**
 * Calculate a transaction timing suspicion score (0-1).
 * Higher = more suspicious patterns in early transaction timing.
 */
export function calculateTimingSuspicion(transactions: ParsedTransaction[]): number {
  const buyTxs = transactions.filter((tx) => tx.type === "buy");
  if (buyTxs.length < 5) return 0;

  const sorted = [...buyTxs].sort((a, b) => a.timestamp - b.timestamp);

  // Only analyze the first 5 minutes of trading
  // Looking at all 500 txs gives false positives on mature tokens
  const firstTxTime = sorted[0].timestamp;
  const earlyBuys = sorted.filter((tx) => tx.timestamp - firstTxTime < 5 * 60_000);
  if (earlyBuys.length < 3) return 0;

  // 1. Many transactions in first 10 seconds (pre-programmed bots)
  const first10Seconds = earlyBuys.filter((tx) => tx.timestamp - firstTxTime < 10_000);
  const earlyBurstSuspicion = first10Seconds.length > 10 ? 0.8 :
    first10Seconds.length > 5 ? 0.5 : first10Seconds.length > 2 ? 0.2 : 0;

  // 2. Same-slot txs from different wallets (ratio-based, not absolute)
  const slotCounts = new Map<number, Set<string>>();
  for (const tx of earlyBuys) {
    if (!slotCounts.has(tx.slot)) slotCounts.set(tx.slot, new Set());
    slotCounts.get(tx.slot)!.add(tx.signer);
  }
  const multiWalletSlots = [...slotCounts.values()].filter((s) => s.size > 1).length;
  const totalSlots = slotCounts.size;
  const slotRatio = totalSlots > 0 ? multiWalletSlots / totalSlots : 0;
  const slotSuspicion = slotRatio > 0.5 ? 0.8 : slotRatio > 0.25 ? 0.5 : slotRatio > 0.1 ? 0.25 : 0;

  // 3. Interval regularity (only with enough early data)
  let regularitySuspicion = 0;
  if (earlyBuys.length >= 8) {
    const intervals: number[] = [];
    for (let i = 1; i < earlyBuys.length; i++) {
      intervals.push(earlyBuys[i].timestamp - earlyBuys[i - 1].timestamp);
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    regularitySuspicion = cv < 0.2 ? 0.7 : cv < 0.4 ? 0.3 : 0;
  }

  // Weighted combination
  return Math.min(1, earlyBurstSuspicion * 0.4 + slotSuspicion * 0.4 + regularitySuspicion * 0.2);
}
