/**
 * J33T Intel Scoring Engine
 *
 * Calculates Potential Score and Rugpull Risk Score
 * from raw detection signals.
 *
 * Design: Each signal has a weight and a normalizer function.
 * Weights can be overridden by community-calibrated values.
 */

import type { DetectionSignals, AnalysisScores, SignalScore } from "../types/analysis.js";

/** Signal weight configuration — the baseline formula */
export interface SignalWeights {
  liquidityGrowthRate: number;
  buySellRatio: number;
  bundlePercentage: number;
  top10HolderPercentage: number;
  devSoldPercentage: number;
  liquidityLocked: number;
  volumeMcapRatio: number;
  priceMomentumScore: number;
  hasFreezeAuthority: number;
  hasMintAuthority: number;
  transactionTimingSuspicion: number;
  uniqueWalletsFirst10Min: number;
}

/**
 * Default weights — baseline v0.1
 * These will be calibrated by community data over time.
 * Higher weight = more influence on final score.
 */
export const DEFAULT_POTENTIAL_WEIGHTS: SignalWeights = {
  liquidityGrowthRate: 0.10,
  buySellRatio: 0.12,
  bundlePercentage: 0.08,
  top10HolderPercentage: 0.10,
  devSoldPercentage: 0.08,
  liquidityLocked: 0.08,
  volumeMcapRatio: 0.10,
  priceMomentumScore: 0.12,
  hasFreezeAuthority: 0.05,
  hasMintAuthority: 0.05,
  transactionTimingSuspicion: 0.05,
  uniqueWalletsFirst10Min: 0.07,
};

export const DEFAULT_RISK_WEIGHTS: SignalWeights = {
  liquidityGrowthRate: 0.05,
  buySellRatio: 0.08,
  bundlePercentage: 0.15,
  top10HolderPercentage: 0.12,
  devSoldPercentage: 0.12,
  liquidityLocked: 0.10,
  volumeMcapRatio: 0.05,
  priceMomentumScore: 0.08,
  hasFreezeAuthority: 0.08,
  hasMintAuthority: 0.07,
  transactionTimingSuspicion: 0.05,
  uniqueWalletsFirst10Min: 0.05,
};

/**
 * Normalize a raw signal value to 0-100 scale.
 * Each signal has its own normalization logic.
 */
export function normalizePotentialSignal(
  signal: keyof DetectionSignals,
  value: number | boolean,
): { score: number; reason: string } {
  switch (signal) {
    case "liquidityGrowthRate": {
      // Good: $50-500/min organic growth. Bad: <$10 or >$2000 (artificial)
      const v = value as number;
      if (v < 10) return { score: 15, reason: "Very low liquidity growth" };
      if (v <= 500) return { score: Math.min(90, 30 + (v / 500) * 60), reason: "Healthy liquidity growth" };
      if (v <= 2000) return { score: 50, reason: "High liquidity growth — possible artificial injection" };
      return { score: 20, reason: "Extremely high growth — likely artificial" };
    }

    case "buySellRatio": {
      // Good: 1.5-5x more buys than sells early on
      const v = value as number;
      if (v < 0.5) return { score: 10, reason: "Heavy sell pressure" };
      if (v < 1.0) return { score: 30, reason: "More sells than buys" };
      if (v <= 5.0) return { score: Math.min(95, 40 + (v / 5) * 55), reason: "Strong buy pressure" };
      return { score: 50, reason: "Extreme buy ratio — could be wash trading" };
    }

    case "bundlePercentage": {
      // Lower is better for potential
      const v = value as number;
      if (v <= 5) return { score: 90, reason: "Minimal bundle activity" };
      if (v <= 15) return { score: 65, reason: "Some bundle activity detected" };
      if (v <= 30) return { score: 35, reason: "Significant bundle concentration" };
      return { score: 10, reason: "Heavy bundling — likely coordinated" };
    }

    case "top10HolderPercentage": {
      // Lower concentration = better distribution
      const v = value as number;
      if (v <= 20) return { score: 90, reason: "Well distributed" };
      if (v <= 40) return { score: 65, reason: "Moderate concentration" };
      if (v <= 60) return { score: 35, reason: "High concentration" };
      return { score: 10, reason: "Extreme concentration — dump risk" };
    }

    case "devSoldPercentage": {
      // Lower is better (dev hasn't dumped)
      const v = value as number;
      if (v === 0) return { score: 95, reason: "Dev hasn't sold" };
      if (v <= 10) return { score: 70, reason: "Dev sold small amount" };
      if (v <= 30) return { score: 40, reason: "Dev sold significant amount" };
      return { score: 10, reason: "Dev has dumped most holdings" };
    }

    case "liquidityLocked": {
      const v = value as boolean;
      return v
        ? { score: 85, reason: "Liquidity is locked" }
        : { score: 25, reason: "Liquidity is NOT locked" };
    }

    case "volumeMcapRatio": {
      // Healthy: 0.3-2.0x ratio
      const v = value as number;
      if (v < 0.1) return { score: 20, reason: "Very low trading activity" };
      if (v <= 2.0) return { score: Math.min(90, 30 + (v / 2) * 60), reason: "Healthy trading volume" };
      return { score: 45, reason: "Volume exceeds MCap — possible wash trading" };
    }

    case "priceMomentumScore": {
      // -1 to 1 scale, positive = organic
      const v = value as number;
      const normalized = ((v + 1) / 2) * 100;
      const reason = v > 0.3 ? "Organic price growth" : v > 0 ? "Slight upward momentum" : "Negative or artificial momentum";
      return { score: Math.max(0, Math.min(100, normalized)), reason };
    }

    case "hasFreezeAuthority": {
      const v = value as boolean;
      return v
        ? { score: 10, reason: "Freeze authority exists — tokens can be frozen" }
        : { score: 90, reason: "No freeze authority" };
    }

    case "hasMintAuthority": {
      const v = value as boolean;
      return v
        ? { score: 15, reason: "Mint authority exists — supply can be inflated" }
        : { score: 90, reason: "No mint authority" };
    }

    case "transactionTimingSuspicion": {
      // 0-1, lower is better
      const v = value as number;
      const score = Math.max(0, 100 - v * 100);
      const reason = v < 0.2 ? "Normal transaction timing" : v < 0.5 ? "Slightly suspicious timing" : "Highly suspicious — bundle signature";
      return { score, reason };
    }

    case "uniqueWalletsFirst10Min": {
      // More unique wallets = better (organic interest)
      const v = value as number;
      if (v < 10) return { score: 20, reason: "Very few unique buyers" };
      if (v <= 50) return { score: 50 + (v / 50) * 30, reason: "Moderate organic interest" };
      if (v <= 200) return { score: 85, reason: "Strong organic interest" };
      return { score: 70, reason: "Extremely high count — verify not Sybil" };
    }

    default:
      return { score: 50, reason: "Unknown signal" };
  }
}

/**
 * Calculate composite scores from raw signals
 */
export function calculateScores(
  signals: DetectionSignals,
  potentialWeights: SignalWeights = DEFAULT_POTENTIAL_WEIGHTS,
  riskWeights: SignalWeights = DEFAULT_RISK_WEIGHTS,
): AnalysisScores {
  const signalBreakdown: SignalScore[] = [];
  let potentialWeightedSum = 0;
  let riskWeightedSum = 0;

  const signalKeys = Object.keys(signals) as (keyof DetectionSignals)[];

  for (const key of signalKeys) {
    // Skip non-weight signals
    if (!(key in potentialWeights)) continue;

    const rawValue = signals[key];
    const { score: normalizedScore, reason } = normalizePotentialSignal(key, rawValue);

    const pWeight = potentialWeights[key as keyof SignalWeights];
    const rWeight = riskWeights[key as keyof SignalWeights];

    potentialWeightedSum += normalizedScore * pWeight;
    // For risk, we invert the score (good potential signal = low risk)
    riskWeightedSum += (100 - normalizedScore) * rWeight;

    signalBreakdown.push({
      signal: key,
      rawValue,
      normalizedScore,
      weight: pWeight,
      weightedScore: normalizedScore * pWeight,
      reason,
    });
  }

  // Clamp to 0-100
  const potentialScore = Math.max(0, Math.min(100, Math.round(potentialWeightedSum)));
  const rugpullRiskScore = Math.max(0, Math.min(100, Math.round(riskWeightedSum)));

  // Confidence is based on how many signals we actually have data for
  const totalSignals = signalKeys.length;
  const nonZeroSignals = signalKeys.filter((k) => signals[k] !== 0 && signals[k] !== false).length;
  const confidence = Math.round((nonZeroSignals / totalSignals) * 100);

  return {
    potentialScore,
    rugpullRiskScore,
    confidence,
    signalBreakdown,
  };
}
