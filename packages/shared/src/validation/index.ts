/**
 * Validation utilities for J33T Intel
 * Validates community submissions, config, and token CAs.
 */

import type { CommunitySubmission, DetectionSignals, J33TConfig } from "../types/index.js";
import { REQUIRED_CONFIG_KEYS } from "../types/config.js";

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate a Solana token contract address */
export function isValidSolanaCA(ca: string): boolean {
  // Solana addresses are base58-encoded, 32-44 characters
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca);
}

/** Validate a community submission before sending to central API */
export function validateSubmission(submission: CommunitySubmission): ValidationResult {
  const errors: string[] = [];

  if (!isValidSolanaCA(submission.tokenCA)) {
    errors.push("Invalid token CA format");
  }

  if (!submission.analyzedAt || submission.analyzedAt > Date.now() + 60_000) {
    errors.push("Invalid analysis timestamp");
  }

  if (!["positive", "negative", "unknown"].includes(submission.patternType)) {
    errors.push("Invalid pattern type");
  }

  // Validate signal ranges
  const s = submission.signals;
  if (s.buySellRatio < 0) errors.push("buySellRatio cannot be negative");
  if (s.bundlePercentage < 0 || s.bundlePercentage > 100) errors.push("bundlePercentage must be 0-100");
  if (s.top10HolderPercentage < 0 || s.top10HolderPercentage > 100) errors.push("top10HolderPercentage must be 0-100");
  if (s.devSoldPercentage < 0 || s.devSoldPercentage > 100) errors.push("devSoldPercentage must be 0-100");

  // Validate scores
  const { potentialScore, rugpullRiskScore, confidence } = submission.scores;
  if (potentialScore < 0 || potentialScore > 100) errors.push("potentialScore must be 0-100");
  if (rugpullRiskScore < 0 || rugpullRiskScore > 100) errors.push("rugpullRiskScore must be 0-100");
  if (confidence < 0 || confidence > 100) errors.push("confidence must be 0-100");

  if (!submission.clientVersion) {
    errors.push("clientVersion is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Validate CLI config */
export function validateConfig(config: Partial<J33TConfig>): ValidationResult {
  const errors: string[] = [];

  for (const key of REQUIRED_CONFIG_KEYS) {
    if (!config[key]) {
      errors.push(`Missing required config: ${key}`);
    }
  }

  if (config.aiProvider && !["anthropic", "openai"].includes(config.aiProvider)) {
    errors.push('aiProvider must be "anthropic" or "openai"');
  }

  if (config.walletAddress && !isValidSolanaCA(config.walletAddress)) {
    errors.push("Invalid wallet address format");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Check for suspicious/outlier values in signals (for community DB intake) */
export function detectOutliers(signals: DetectionSignals): string[] {
  const warnings: string[] = [];

  if (signals.liquidityGrowthRate > 10_000) {
    warnings.push("Unusually high liquidity growth rate — potential data error");
  }

  if (signals.buySellRatio > 50) {
    warnings.push("Extreme buy/sell ratio — potential wash trading or data error");
  }

  if (signals.uniqueWalletsFirst10Min > 1000) {
    warnings.push("Unusually high unique wallet count — potential Sybil or data error");
  }

  if (signals.bundleCount > 50) {
    warnings.push("Extreme bundle count — unusual");
  }

  return warnings;
}
