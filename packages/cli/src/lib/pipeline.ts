import { extractDetailedPatterns } from "@j33t-intel/shared";
/**
 * Backtester Pipeline
 *
 * The main analysis orchestrator. Takes a token CA, fetches all data,
 * runs all analysis modules, and produces the final AnalysisResult JSON.
 *
 * Pipeline steps:
 * 1. Fetch market data from DexScreener
 * 2. Fetch transaction history from Helius
 * 3. Parse and classify transactions
 * 4. Detect bundles
 * 5. Analyze dev wallet
 * 6. Get holder distribution
 * 7. Extract all detection signals
 * 8. Calculate scores
 * 9. Find optimal entry point (backtester mode)
 * 10. Generate filter settings
 * 11. Produce final JSON output
 */

import type {
  ParsedTransaction,
  J33TConfig,
  TokenCA,
  TokenMetadata,
  AnalysisResult,
  AnalysisMode,
  MarketSnapshot,
  FilterSettings,
  DetectionSignals,
} from "@j33t-intel/shared";
import {
  calculateScores,
  isValidSolanaCA,
  SCHEMA_VERSION,
} from "@j33t-intel/shared";

import { HeliusService } from "../services/helius.js";
import { DexScreenerService } from "../services/dexscreener.js";
import { parseTransactions } from "./transaction-parser.js";
import { detectBundles } from "./bundle-detector.js";
import { analyzeDevWallet, identifyDeployer } from "./dev-wallet-analyzer.js";
import { extractSignals } from "./signal-extractor.js";
import type {
  SignalExtractionInput } from "./signal-extractor.js";

/** Progress callback for UI updates */
export type ProgressCallback = (step: string, detail?: string) => void;

/** Pipeline result wrapper */
export interface PipelineResult {
  success: boolean;
  result?: AnalysisResult;
  error?: string;
  durationMs: number;
}

/**
 * Run the full backtester analysis pipeline on a token.
 */
export async function runBacktesterPipeline(
  tokenCA: TokenCA,
  config: J33TConfig,
  onProgress?: ProgressCallback,
): Promise<PipelineResult> {
  const startTime = Date.now();

  // Validate input
  if (!isValidSolanaCA(tokenCA)) {
    return { success: false, error: "Invalid Solana token address", durationMs: 0 };
  }

  const helius = new HeliusService(config);
  const dexScreener = new DexScreenerService(config);

  try {
    // Step 1: Fetch market data
    onProgress?.("market_data", "Fetching market data from DexScreener...");

    const primaryPair = await dexScreener.getPrimaryPair(tokenCA);
    const marketSnapshot = dexScreener.pairToMarketSnapshot(primaryPair);
    const partialMetadata = dexScreener.pairToPartialMetadata(primaryPair);
    const txCounts = dexScreener.extractTransactionCounts(primaryPair);

    onProgress?.("market_data", `${partialMetadata.symbol} — MCap: $${(marketSnapshot.mcapUsd / 1000).toFixed(1)}K`);

    // Step 2: Fetch transaction history
    onProgress?.("transactions", "Fetching transaction history from Helius...");

    const heliusTxs = await helius.getTokenTransactionHistory(tokenCA, {
      maxTransactions: 500, // First ~500 transactions covers the early phase
    });

    onProgress?.("transactions", `Fetched ${heliusTxs.length} transactions`);

    // Step 3: Parse and classify transactions
    onProgress?.("parsing", "Parsing and classifying transactions...");

    const parsedTxs = parseTransactions(heliusTxs, tokenCA);

    const buys = parsedTxs.filter((tx) => tx.type === "buy").length;
    const sells = parsedTxs.filter((tx) => tx.type === "sell").length;
    onProgress?.("parsing", `${parsedTxs.length} relevant txs (${buys} buys, ${sells} sells)`);

    // Step 4: Identify deployer
    onProgress?.("deployer", "Identifying deployer wallet...");

    const deployer = identifyDeployer(parsedTxs) ?? partialMetadata.ca ?? "unknown";
    onProgress?.("deployer", `Deployer: ${deployer.slice(0, 8)}...`);

    // Step 5: Detect bundles
    onProgress?.("bundles", "Detecting coordinated wallet bundles...");

    // Estimate total supply from market data
    const estimatedTotalSupply = marketSnapshot.priceUsd > 0
      ? marketSnapshot.mcapUsd / marketSnapshot.priceUsd
      : 0;

    const bundles = detectBundles(parsedTxs, estimatedTotalSupply);
    onProgress?.("bundles", `Found ${bundles.length} potential bundles`);

    // Step 6: Analyze dev wallet
    onProgress?.("dev_wallet", "Analyzing deployer wallet behavior...");

    const devActivity = analyzeDevWallet(parsedTxs, deployer, estimatedTotalSupply);
    onProgress?.("dev_wallet", devActivity.hasSold
      ? `Dev has sold ${devActivity.soldPercentage.toFixed(1)}% of supply`
      : "Dev has NOT sold");

    // Step 7: Get holder distribution
    onProgress?.("holders", "Checking holder distribution...");

    let top10HolderPercentage = 0;
    try {
      const largestAccounts = await helius.getTokenLargestAccounts(tokenCA);
      if (largestAccounts.length > 0) {
        const totalFromTop10 = largestAccounts
          .slice(0, 10)
          .reduce((sum, acc) => sum + acc.uiAmount, 0);

        // Estimate total supply from the largest accounts (rough)
        const totalFromAll = largestAccounts.reduce((sum, acc) => sum + acc.uiAmount, 0);
        top10HolderPercentage = totalFromAll > 0
          ? (totalFromTop10 / totalFromAll) * 100
          : 0;
      }
    } catch {
      // If we can't get holder data, use a default
      top10HolderPercentage = 50; // Conservative estimate
      onProgress?.("holders", "Could not fetch holder data — using estimate");
    }
    onProgress?.("holders", `Top 10 holders: ${top10HolderPercentage.toFixed(1)}%`);

    // Step 8: Extract detection signals
    onProgress?.("signals", "Computing detection signals...");

    // Determine liquidity lock status (simplified — in production, check on-chain)
    // For now, we assume not locked unless we can verify
    const liquidityLocked = false;
    const liquidityLockDurationHours = 0;

    const tokenCreatedAt = partialMetadata.createdAt ?? parsedTxs[0]?.timestamp ?? Date.now();

    const metadata: TokenMetadata = {
      ca: tokenCA,
      name: partialMetadata.name ?? "Unknown",
      symbol: partialMetadata.symbol ?? "???",
      decimals: 9, // Default for most Solana tokens
      deployer,
      createdAt: tokenCreatedAt,
      hasFreezeAuthority: false, // TODO: Check on-chain
      hasMintAuthority: false,   // TODO: Check on-chain
      socials: partialMetadata.socials,
    };

    const signalInput: SignalExtractionInput = {
      transactions: parsedTxs,
      bundles,
      devActivity,
      metadata,
      marketSnapshot,
      tokenCreatedAt,
      top10HolderPercentage,
      liquidityLocked,
      liquidityLockDurationHours,
    };

    const signals = extractSignals(signalInput);
    onProgress?.("signals", "All detection signals computed");

    // Step 9: Calculate scores
    onProgress?.("scoring", "Calculating scores...");

    const scores = calculateScores(signals);
    onProgress?.("scoring", `Potential: ${scores.potentialScore}/100 | Risk: ${scores.rugpullRiskScore}/100`);

    // Step 10: Find optimal entry point (backtester-specific)
    onProgress?.("entry_point", "Finding optimal entry point...");

    const entrySnapshot = findOptimalEntry(parsedTxs, marketSnapshot, tokenCreatedAt);
    onProgress?.("entry_point", entrySnapshot
      ? `Entry at $${(entrySnapshot.mcapUsd / 1000).toFixed(1)}K MCap`
      : "No entry point under $100K found");

    // Step 11: Generate optimal filter settings
    const filterSettings = generateFilterSettings(signals, scores);

    // Build final result
    const durationMs = Date.now() - startTime;


    // Extract detailed patterns for AI training
    const detailedPatterns = extractDetailedPatterns(
      parsedTxs.map(t => ({ timestamp: t.timestamp, slot: t.slot, type: t.type, signer: t.signer, tokenAmount: t.tokenAmount ?? 0, solAmount: t.solAmount ?? 0 })),
      deployer,
      bundles.map(b => ({ wallets: b.wallets, txCount: b.transactions?.length ?? b.wallets.length })),
    );
    const result: AnalysisResult = {
      schemaVersion: SCHEMA_VERSION,
      tokenCA,
      analyzedAt: Date.now(),
      analysisDurationMs: durationMs,
      metadata,
      patternType: scores.rugpullRiskScore > 60 ? "negative" : scores.potentialScore > 60 ? "positive" : "unknown",
      marketSnapshot,
      entrySnapshot: entrySnapshot ?? undefined,
      athSnapshot: undefined, // TODO: Track ATH from historical data
      signals,
      scores,
      filterSettings,
      bundles,
      devActivity,
      mode: "backtester" as AnalysisMode,
      detailedPatterns,
    };

    onProgress?.("complete", `Analysis complete in ${(durationMs / 1000).toFixed(1)}s`);

    return { success: true, result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message, durationMs };
  }
}

/**
 * Run the rugpull pattern analysis pipeline.
 * Similar to backtester but focuses on extracting negative patterns.
 */
export async function runRugcheckPipeline(
  tokenCA: TokenCA,
  config: J33TConfig,
  onProgress?: ProgressCallback,
): Promise<PipelineResult> {
  // The pipeline is almost identical — the main difference is in how we
  // interpret the results and what we output.
  const pipelineResult = await runBacktesterPipeline(tokenCA, config, onProgress);

  if (pipelineResult.success && pipelineResult.result) {
    // Override mode and pattern type for rugcheck
    pipelineResult.result.mode = "rugpull_pattern";
    pipelineResult.result.patternType = "negative";
  }

  return pipelineResult;
}

/**
 * Find the optimal entry point — the moment when the token
 * could have been detected under $100K MCap with the best signal quality.
 */
function findOptimalEntry(
  transactions: ParsedTransaction[],
  currentMarket: MarketSnapshot,
  tokenCreatedAt: number,
): MarketSnapshot | null {
  if (transactions.length === 0) return null;

  // For backtesting, we want to find the point where:
  // 1. MCap was still under $100K
  // 2. There was enough data to make a confident call
  // 3. The buy/sell ratio was favorable

  // Since we don't have historical MCap data per-transaction,
  // we estimate based on the relationship between current MCap
  // and the token's age + early volume.

  const firstTxTime = transactions[0].timestamp;
  const earlyBuys = transactions.filter(
    (tx) => tx.type === "buy" && tx.timestamp < firstTxTime + 30 * 60_000, // First 30 min
  );

  if (earlyBuys.length < 3) return null;

  // Estimate entry MCap based on early SOL volume
  // This is a rough heuristic — in production, we'd use actual price data
  const earlySolVolume = earlyBuys.reduce((sum, tx) => sum + tx.solAmount, 0);

  // Assume entry MCap was roughly proportional to accumulated volume
  // A very rough estimate, but useful for backtesting
  const estimatedEntryMcap = Math.min(100_000, earlySolVolume * 1000);

  if (estimatedEntryMcap > 100_000) return null; // Over our threshold

  // Pick the entry point at ~10-15 minutes after first buy
  // (enough data to analyze, but still early)
  const entryTime = firstTxTime + 10 * 60_000;

  return {
    timestamp: entryTime,
    mcapUsd: estimatedEntryMcap,
    priceUsd: 0, // We don't have historical price
    liquidityUsd: earlySolVolume * 150, // Rough SOL-to-USD estimate
    volumeUsd: earlySolVolume * 150,
  };
}

/**
 * Generate optimal filter settings based on the analysis results.
 * These settings represent what would have caught this token (or filtered it out).
 */
function generateFilterSettings(
  signals: DetectionSignals,
  scores: ReturnType<typeof calculateScores>,
): FilterSettings {
  // For positive patterns: settings that would have CAUGHT this token
  // For negative patterns: settings that would have REJECTED this token
  const isPositive = scores.potentialScore > scores.rugpullRiskScore;

  if (isPositive) {
    // Generate settings slightly looser than this token's signals
    // so they would have triggered an alert
    return {
      minLiquidityUsd: Math.max(500, signals.liquidityGrowthRate * 5),
      maxBundlePercentage: Math.max(15, signals.bundlePercentage + 5),
      minBuySellRatio: Math.max(1.0, signals.buySellRatio * 0.7),
      maxDevSoldPercentage: Math.max(10, signals.devSoldPercentage + 5),
      maxTop10HolderPercentage: Math.max(40, signals.top10HolderPercentage + 10),
      minUniqueWallets10Min: Math.max(5, Math.floor(signals.uniqueWalletsFirst10Min * 0.6)),
      requireLiquidityLock: false,
      rejectFreezeAuthority: true,
      rejectMintAuthority: true,
      maxEntryMcapUsd: 100_000,
    };
  } else {
    // For negative patterns, generate strict settings that would have rejected it
    return {
      minLiquidityUsd: Math.max(1000, signals.liquidityGrowthRate * 10),
      maxBundlePercentage: Math.min(10, signals.bundlePercentage * 0.5),
      minBuySellRatio: Math.max(1.5, signals.buySellRatio * 1.5),
      maxDevSoldPercentage: Math.min(5, signals.devSoldPercentage * 0.3),
      maxTop10HolderPercentage: Math.min(30, signals.top10HolderPercentage * 0.5),
      minUniqueWallets10Min: Math.max(15, signals.uniqueWalletsFirst10Min * 1.5),
      requireLiquidityLock: true,
      rejectFreezeAuthority: true,
      rejectMintAuthority: true,
      maxEntryMcapUsd: 100_000,
    };
  }
}
