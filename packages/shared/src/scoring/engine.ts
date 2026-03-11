import type { DetectionSignals, AnalysisScores, SignalScore } from "../types/analysis.js";

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

export const DEFAULT_POTENTIAL_WEIGHTS: SignalWeights = {
  liquidityGrowthRate: 0.08,
  buySellRatio: 0.14,
  bundlePercentage: 0.10,
  top10HolderPercentage: 0.06,
  devSoldPercentage: 0.12,
  liquidityLocked: 0.06,
  volumeMcapRatio: 0.10,
  priceMomentumScore: 0.10,
  hasFreezeAuthority: 0.06,
  hasMintAuthority: 0.06,
  transactionTimingSuspicion: 0.04,
  uniqueWalletsFirst10Min: 0.08,
};

export const DEFAULT_RISK_WEIGHTS: SignalWeights = {
  liquidityGrowthRate: 0.04,
  buySellRatio: 0.08,
  bundlePercentage: 0.18,
  top10HolderPercentage: 0.08,
  devSoldPercentage: 0.16,
  liquidityLocked: 0.08,
  volumeMcapRatio: 0.04,
  priceMomentumScore: 0.06,
  hasFreezeAuthority: 0.10,
  hasMintAuthority: 0.08,
  transactionTimingSuspicion: 0.04,
  uniqueWalletsFirst10Min: 0.06,
};

export function normalizePotentialSignal(
  signal: keyof DetectionSignals,
  value: number | boolean,
): { score: number; reason: string } {
  switch (signal) {
    case "liquidityGrowthRate": {
      const v = value as number;
      if (v < 5) return { score: 15, reason: "Very low liquidity growth" };
      if (v <= 100) return { score: 30 + (v / 100) * 40, reason: "Moderate liquidity growth" };
      if (v <= 1000) return { score: 70 + ((v - 100) / 900) * 20, reason: "Healthy liquidity growth" };
      if (v <= 5000) return { score: 60, reason: "High growth — possible artificial injection" };
      return { score: 25, reason: "Extremely high growth — likely artificial" };
    }

    case "buySellRatio": {
      const v = value as number;
      if (v < 0.3) return { score: 5, reason: "Extreme sell pressure" };
      if (v < 0.7) return { score: 20, reason: "Heavy sell pressure" };
      if (v < 1.0) return { score: 35, reason: "More sells than buys" };
      if (v < 1.5) return { score: 50, reason: "Balanced trading" };
      if (v <= 3.0) return { score: 75 + ((v - 1.5) / 1.5) * 20, reason: "Strong buy pressure" };
      if (v <= 8.0) return { score: 85, reason: "Very strong buy pressure" };
      return { score: 55, reason: "Extreme buy ratio — possible wash trading" };
    }

    case "bundlePercentage": {
      const v = value as number;
      if (v <= 2) return { score: 95, reason: "Minimal bundle activity" };
      if (v <= 8) return { score: 75, reason: "Low bundle activity" };
      if (v <= 20) return { score: 50, reason: "Moderate bundle activity" };
      if (v <= 40) return { score: 25, reason: "Significant bundle concentration" };
      return { score: 5, reason: "Heavy bundling — likely coordinated" };
    }

    case "top10HolderPercentage": {
      // On Solana, top 10 often includes LP pools and exchanges
      // so thresholds need to be more forgiving
      const v = value as number;
      if (v <= 30) return { score: 95, reason: "Excellent distribution" };
      if (v <= 50) return { score: 80, reason: "Good distribution" };
      if (v <= 70) return { score: 60, reason: "Moderate concentration (typical for Solana)" };
      if (v <= 85) return { score: 40, reason: "High concentration — includes LP/exchanges" };
      return { score: 15, reason: "Extreme concentration — dump risk" };
    }

    case "devSoldPercentage": {
      const v = value as number;
      if (v === 0) return { score: 95, reason: "Dev hasn't sold" };
      if (v <= 5) return { score: 80, reason: "Dev sold minimal amount" };
      if (v <= 15) return { score: 55, reason: "Dev sold moderate amount" };
      if (v <= 40) return { score: 25, reason: "Dev sold significant amount" };
      return { score: 5, reason: "Dev has dumped most holdings" };
    }

    case "liquidityLocked": {
      const v = value as boolean;
      return v
        ? { score: 85, reason: "Liquidity is locked" }
        : { score: 35, reason: "Liquidity is NOT locked" };
    }

    case "volumeMcapRatio": {
      const v = value as number;
      if (v < 0.001) return { score: 10, reason: "Almost no trading activity" };
      if (v < 0.01) return { score: 30, reason: "Very low trading activity" };
      if (v < 0.1) return { score: 55, reason: "Low but present trading" };
      if (v <= 1.0) return { score: 80, reason: "Healthy trading volume" };
      if (v <= 3.0) return { score: 90, reason: "Strong trading volume" };
      return { score: 50, reason: "Volume significantly exceeds MCap — possible wash trading" };
    }

    case "priceMomentumScore": {
      const v = value as number;
      if (v < -0.5) return { score: 10, reason: "Strong negative momentum" };
      if (v < 0) return { score: 35, reason: "Negative momentum" };
      if (v < 0.3) return { score: 55, reason: "Slight upward momentum" };
      if (v < 0.7) return { score: 80, reason: "Healthy organic growth" };
      return { score: 90, reason: "Strong organic growth" };
    }

    case "hasFreezeAuthority": {
      const v = value as boolean;
      return v
        ? { score: 5, reason: "Freeze authority exists — dev can freeze holders" }
        : { score: 90, reason: "No freeze authority" };
    }

    case "hasMintAuthority": {
      const v = value as boolean;
      return v
        ? { score: 10, reason: "Mint authority exists — supply can be inflated" }
        : { score: 90, reason: "No mint authority" };
    }

    case "transactionTimingSuspicion": {
      const v = value as number;
      if (v < 0.15) return { score: 90, reason: "Normal transaction timing" };
      if (v < 0.35) return { score: 70, reason: "Slightly clustered timing" };
      if (v < 0.6) return { score: 45, reason: "Suspicious timing patterns" };
      if (v < 0.8) return { score: 25, reason: "Highly suspicious timing" };
      return { score: 10, reason: "Bot-like transaction timing" };
    }

    case "uniqueWalletsFirst10Min": {
      const v = value as number;
      if (v < 3) return { score: 15, reason: "Almost no unique buyers" };
      if (v < 10) return { score: 35, reason: "Few unique buyers" };
      if (v <= 30) return { score: 60, reason: "Moderate organic interest" };
      if (v <= 80) return { score: 80, reason: "Strong organic interest" };
      if (v <= 200) return { score: 90, reason: "Very strong organic interest" };
      return { score: 65, reason: "Extremely high count — verify not Sybil" };
    }

    default:
      return { score: 50, reason: "Unknown signal" };
  }
}

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
    if (!(key in potentialWeights)) continue;
    const rawValue = signals[key];
    const { score: normalizedScore, reason } = normalizePotentialSignal(key, rawValue);
    const pWeight = potentialWeights[key as keyof SignalWeights];
    const rWeight = riskWeights[key as keyof SignalWeights];
    potentialWeightedSum += normalizedScore * pWeight;
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

  const potentialScore = Math.max(0, Math.min(100, Math.round(potentialWeightedSum)));
  const rugpullRiskScore = Math.max(0, Math.min(100, Math.round(riskWeightedSum)));

  const totalSignals = signalKeys.length;
  const nonZeroSignals = signalKeys.filter((k) => signals[k] !== 0 && signals[k] !== false).length;
  const confidence = Math.round((nonZeroSignals / totalSignals) * 100);

  return { potentialScore, rugpullRiskScore, confidence, signalBreakdown };
}
