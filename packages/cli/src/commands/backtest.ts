/**
 * Backtest command — analyze a successful token's early history
 * and find the optimal filter settings that would have caught it.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import type { J33TConfig, AnalysisResult, CommunitySubmission } from "@j33t-intel/shared";
import { formatUsd, formatPercent, VERSION } from "@j33t-intel/shared";
import { runBacktesterPipeline } from "../lib/pipeline.js";

interface BacktestOptions {
  output?: string;
  contribute?: boolean;
  verbose?: boolean;
}

export async function backtestCommand(
  tokenCA: string,
  config: J33TConfig,
  options: BacktestOptions,
): Promise<void> {
  console.log();
  console.log(chalk.bold("🐾 J33T Intel — Backtester"));
  console.log(chalk.gray(`   Token: ${tokenCA}`));
  console.log(chalk.gray("   Mode: Reconstruct early trading history → find optimal filters"));
  console.log();

  const spinner = ora({ text: "Starting analysis...", color: "yellow" }).start();

  const result = await runBacktesterPipeline(tokenCA, config, (step, detail) => {
    const stepEmojis: Record<string, string> = {
      market_data: "📊",
      transactions: "📡",
      parsing: "🔍",
      deployer: "👤",
      bundles: "🔗",
      dev_wallet: "💰",
      holders: "👥",
      signals: "📶",
      scoring: "🎯",
      entry_point: "🚀",
      complete: "✅",
    };
    const emoji = stepEmojis[step] ?? "⏳";
    spinner.text = `${emoji} ${detail ?? step}`;
  });

  spinner.stop();

  if (!result.success || !result.result) {
    console.log(chalk.red(`\n❌ Analysis failed: ${result.error}`));
    process.exit(1);
  }

  const analysis = result.result;

  // Display results
  printResults(analysis);

  // Save JSON output
  const outputPath = options.output ?? `j33t-${analysis.metadata.symbol}-backtest.json`;
  const fullPath = resolve(process.cwd(), outputPath);
  writeFileSync(fullPath, JSON.stringify(analysis, null, 2), "utf-8");
  console.log(chalk.green(`\n💾 JSON output saved: ${outputPath}`));

  // Submit to community database if opted in
  if (options.contribute || config.contributeToCommunity) {
    await submitToCommunity(analysis, config);
  }
}

function printResults(analysis: AnalysisResult): void {
  const { metadata, scores, signals, marketSnapshot, filterSettings } = analysis;

  console.log();
  console.log(chalk.bold(`━━━ ${metadata.name} (${metadata.symbol}) ━━━`));
  console.log();

  // Pattern type with color
  const patternColor = analysis.patternType === "positive" ? chalk.green
    : analysis.patternType === "negative" ? chalk.red
    : chalk.yellow;
  console.log(`   Pattern: ${patternColor(analysis.patternType.toUpperCase())}`);
  console.log();

  // Scores
  const potentialColor = scores.potentialScore >= 60 ? chalk.green : scores.potentialScore >= 40 ? chalk.yellow : chalk.red;
  const riskColor = scores.rugpullRiskScore <= 30 ? chalk.green : scores.rugpullRiskScore <= 60 ? chalk.yellow : chalk.red;

  console.log(chalk.bold("   Scores"));
  console.log(`   Potential:    ${potentialColor(String(scores.potentialScore) + "/100")} ${"█".repeat(Math.floor(scores.potentialScore / 5))}${chalk.gray("░".repeat(20 - Math.floor(scores.potentialScore / 5)))}`);
  console.log(`   Rug Risk:     ${riskColor(String(scores.rugpullRiskScore) + "/100")} ${"█".repeat(Math.floor(scores.rugpullRiskScore / 5))}${chalk.gray("░".repeat(20 - Math.floor(scores.rugpullRiskScore / 5)))}`);
  console.log(`   Confidence:   ${scores.confidence}%`);
  console.log();

  // Market data
  console.log(chalk.bold("   Market"));
  console.log(`   MCap:         ${formatUsd(marketSnapshot.mcapUsd)}`);
  console.log(`   Liquidity:    ${formatUsd(marketSnapshot.liquidityUsd)}`);
  console.log(`   Volume 24h:   ${formatUsd(marketSnapshot.volumeUsd)}`);
  console.log();

  // Key signals
  console.log(chalk.bold("   Key Signals"));
  console.log(`   Buy/Sell Ratio:     ${signals.buySellRatio.toFixed(2)}x`);
  console.log(`   Bundle %:           ${formatPercent(signals.bundlePercentage)} (${signals.bundleCount} bundles)`);
  console.log(`   Top 10 Holders:     ${formatPercent(signals.top10HolderPercentage)}`);
  console.log(`   Dev Sold:           ${formatPercent(signals.devSoldPercentage)}`);
  console.log(`   Liquidity Locked:   ${signals.liquidityLocked ? chalk.green("Yes") : chalk.red("No")}`);
  console.log(`   Freeze Authority:   ${signals.hasFreezeAuthority ? chalk.red("Yes ⚠️") : chalk.green("No")}`);
  console.log(`   Mint Authority:     ${signals.hasMintAuthority ? chalk.red("Yes ⚠️") : chalk.green("No")}`);
  console.log(`   Unique Wallets 10m: ${signals.uniqueWalletsFirst10Min}`);
  console.log(`   Timing Suspicion:   ${(signals.transactionTimingSuspicion * 100).toFixed(0)}%`);
  console.log();

  // Entry point
  if (analysis.entrySnapshot) {
    console.log(chalk.bold("   Optimal Entry"));
    console.log(`   MCap at Entry:  ${formatUsd(analysis.entrySnapshot.mcapUsd)}`);
    console.log();
  }

  // Filter settings
  if (filterSettings) {
    console.log(chalk.bold("   Optimal Filter Settings"));
    console.log(`   Min Liquidity:      ${formatUsd(filterSettings.minLiquidityUsd)}`);
    console.log(`   Max Bundle %:       ${formatPercent(filterSettings.maxBundlePercentage)}`);
    console.log(`   Min Buy/Sell Ratio: ${filterSettings.minBuySellRatio.toFixed(2)}x`);
    console.log(`   Max Dev Sold %:     ${formatPercent(filterSettings.maxDevSoldPercentage)}`);
    console.log(`   Max Top 10 %:       ${formatPercent(filterSettings.maxTop10HolderPercentage)}`);
    console.log(`   Min Wallets 10m:    ${filterSettings.minUniqueWallets10Min}`);
    console.log(`   Max Entry MCap:     ${formatUsd(filterSettings.maxEntryMcapUsd)}`);
    console.log();
  }

  // Duration
  console.log(chalk.gray(`   Analysis completed in ${(analysis.analysisDurationMs / 1000).toFixed(1)}s`));
}

async function submitToCommunity(analysis: AnalysisResult, config: J33TConfig): Promise<void> {
  if (!config.centralApiUrl) {
    console.log(chalk.yellow("   ⚠️  No central API URL configured — skipping community submission"));
    return;
  }

  const submission: CommunitySubmission = {
    tokenCA: analysis.tokenCA,
    analyzedAt: analysis.analyzedAt,
    patternType: analysis.patternType,
    signals: analysis.signals,
    scores: analysis.scores,
    filterSettings: analysis.filterSettings,
    entryMcapUsd: analysis.entrySnapshot?.mcapUsd,
    athMcapUsd: analysis.athSnapshot?.mcapUsd,
    clientVersion: VERSION,
  };

  try {
    const response = await fetch(`${config.centralApiUrl}/api/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission, apiKey: config.intelApiKey }),
    });

    if (response.ok) {
      console.log(chalk.green("   ✅ Results submitted to community database"));
    } else {
      console.log(chalk.yellow("   ⚠️  Community submission failed — continuing"));
    }
  } catch {
    console.log(chalk.yellow("   ⚠️  Could not reach central API — continuing"));
  }
}
