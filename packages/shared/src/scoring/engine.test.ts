import { describe, it, expect } from "vitest";
import { calculateScores, normalizePotentialSignal } from "../scoring/engine.js";
import type { DetectionSignals } from "../types/analysis.js";

describe("normalizePotentialSignal", () => {
  it("scores low liquidity growth rate poorly", () => {
    const result = normalizePotentialSignal("liquidityGrowthRate", 5);
    expect(result.score).toBeLessThan(30);
  });

  it("scores healthy liquidity growth well", () => {
    const result = normalizePotentialSignal("liquidityGrowthRate", 200);
    expect(result.score).toBeGreaterThan(50);
  });

  it("penalizes extreme buy/sell ratios", () => {
    const result = normalizePotentialSignal("buySellRatio", 100);
    expect(result.score).toBeLessThan(60);
  });

  it("scores low bundle percentage well", () => {
    const result = normalizePotentialSignal("bundlePercentage", 3);
    expect(result.score).toBeGreaterThan(80);
  });

  it("penalizes freeze authority", () => {
    const result = normalizePotentialSignal("hasFreezeAuthority", true);
    expect(result.score).toBeLessThan(20);
  });

  it("rewards no mint authority", () => {
    const result = normalizePotentialSignal("hasMintAuthority", false);
    expect(result.score).toBeGreaterThan(80);
  });
});

describe("calculateScores", () => {
  const healthySignals: DetectionSignals = {
    liquidityGrowthRate: 150,
    buySellRatio: 3.0,
    bundlePercentage: 5,
    bundleCount: 1,
    top10HolderPercentage: 25,
    devSoldPercentage: 0,
    liquidityLocked: true,
    liquidityLockDurationHours: 72,
    volumeMcapRatio: 0.8,
    priceMomentumScore: 0.6,
    hasFreezeAuthority: false,
    hasMintAuthority: false,
    transactionTimingSuspicion: 0.1,
    uniqueWalletsFirst10Min: 75,
  };

  const ruggySignals: DetectionSignals = {
    liquidityGrowthRate: 5000,
    buySellRatio: 0.3,
    bundlePercentage: 45,
    bundleCount: 8,
    top10HolderPercentage: 80,
    devSoldPercentage: 60,
    liquidityLocked: false,
    liquidityLockDurationHours: 0,
    volumeMcapRatio: 0.05,
    priceMomentumScore: -0.5,
    hasFreezeAuthority: true,
    hasMintAuthority: true,
    transactionTimingSuspicion: 0.8,
    uniqueWalletsFirst10Min: 5,
  };

  it("gives a healthy token a high potential score", () => {
    const scores = calculateScores(healthySignals);
    expect(scores.potentialScore).toBeGreaterThan(60);
  });

  it("gives a healthy token a low risk score", () => {
    const scores = calculateScores(healthySignals);
    expect(scores.rugpullRiskScore).toBeLessThan(40);
  });

  it("gives a ruggy token a low potential score", () => {
    const scores = calculateScores(ruggySignals);
    expect(scores.potentialScore).toBeLessThan(40);
  });

  it("gives a ruggy token a high risk score", () => {
    const scores = calculateScores(ruggySignals);
    expect(scores.rugpullRiskScore).toBeGreaterThan(60);
  });

  it("returns signal breakdown for all signals", () => {
    const scores = calculateScores(healthySignals);
    expect(scores.signalBreakdown.length).toBeGreaterThan(0);
    expect(scores.signalBreakdown[0]).toHaveProperty("signal");
    expect(scores.signalBreakdown[0]).toHaveProperty("normalizedScore");
    expect(scores.signalBreakdown[0]).toHaveProperty("reason");
  });

  it("calculates confidence based on available signals", () => {
    const scores = calculateScores(healthySignals);
    expect(scores.confidence).toBeGreaterThan(80);
  });
});
