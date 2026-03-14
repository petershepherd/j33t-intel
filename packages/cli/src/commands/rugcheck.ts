/**
 * Rugcheck command — analyze a known rugpull to extract negative patterns.
 * Uses the same pipeline as backtester but focuses on extracting
 * behavioral signatures that indicate rug risk.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import type { J33TConfig, AnalysisResult, CommunitySubmission } from "@j33t-intel/shared";
import { formatUsd, formatPercent, VERSION } from "@j33t-intel/shared";
import { runRugcheckPipeline } from "../lib/pipeline.js";

interface RugcheckOptions {
  output?: string;
  contribute?: boolean;
  verbose?: boolean;
}

export async function rugcheckCommand(
  tokenCA: string,
  config: J33TConfig,
  options: RugcheckOptions,
): Promise<void> {
  console.log();
  console.log(chalk.bold("🐾 J33T Intel — Rugpull Pattern Analyzer"));
  console.log(chalk.gray(`   Token: ${tokenCA}`));
  console.log(chalk.gray("   Mode: Extract pre-rug behavioral signatures"));
  console.log();

  const spinner = ora({ text: "Starting analysis...", color: "red" }).start();

  const result = await runRugcheckPipeline(tokenCA, config, (step, detail) => {
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
      entry_point: "🚩",
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

  // Display rug-specific results
  printRugResults(analysis);

  // Save JSON output
  const outputPath = options.output ?? `j33t-${analysis.metadata.symbol}-rugcheck.json`;
  const fullPath = resolve(process.cwd(), outputPath);
  writeFileSync(fullPath, JSON.stringify(analysis, null, 2), "utf-8");
  console.log(chalk.green(`\n💾 JSON output saved: ${outputPath}`));

  // Submit to community database if opted in
  if (options.contribute || config.contributeToCommunity) {
    await submitToCommunity(analysis, config);
  }
}

function printRugResults(analysis: AnalysisResult): void {
  const { metadata, scores, signals, devActivity, bundles } = analysis;

  console.log();
  console.log(chalk.red.bold(`━━━ ⚠️  ${metadata.name} (${metadata.symbol}) — RUGPULL PATTERN ━━━`));
  console.log();

  // Risk score prominently
  console.log(chalk.bold("   Risk Assessment"));
  console.log(`   Rug Risk:     ${chalk.red(String(scores.rugpullRiskScore) + "/100")} ${"█".repeat(Math.floor(scores.rugpullRiskScore / 5))}${chalk.gray("░".repeat(20 - Math.floor(scores.rugpullRiskScore / 5)))}`);
  console.log(`   Confidence:   ${scores.confidence}%`);
  console.log();

  // Red flags
  console.log(chalk.red.bold("   🚩 Red Flags Detected"));

  if (signals.bundlePercentage > 15) {
    console.log(chalk.red(`   • Bundle concentration: ${formatPercent(signals.bundlePercentage)} of supply in ${signals.bundleCount} bundles`));
  }
  if (signals.devSoldPercentage > 10) {
    console.log(chalk.red(`   • Dev wallet sold: ${formatPercent(signals.devSoldPercentage)} of supply`));
  }
  if (!signals.liquidityLocked) {
    console.log(chalk.red("   • Liquidity is NOT locked"));
  }
  if (signals.hasFreezeAuthority) {
    console.log(chalk.red("   • Freeze authority enabled — dev can freeze holders"));
  }
  if (signals.hasMintAuthority) {
    console.log(chalk.red("   • Mint authority enabled — dev can inflate supply"));
  }
  if (signals.top10HolderPercentage > 50) {
    console.log(chalk.red(`   • Extreme holder concentration: top 10 hold ${formatPercent(signals.top10HolderPercentage)}`));
  }
  if (signals.transactionTimingSuspicion > 0.5) {
    console.log(chalk.red(`   • Suspicious transaction timing patterns (${(signals.transactionTimingSuspicion * 100).toFixed(0)}% suspicion)`));
  }
  if (signals.buySellRatio < 1.0) {
    console.log(chalk.red(`   • More sells than buys (ratio: ${signals.buySellRatio.toFixed(2)}x)`));
  }
  if (signals.uniqueWalletsFirst10Min < 10) {
    console.log(chalk.red(`   • Very few unique wallets in first 10 min: ${signals.uniqueWalletsFirst10Min}`));
  }

  console.log();

  // Bundle details
  if (bundles.length > 0) {
    console.log(chalk.bold("   Bundle Details"));
    for (const bundle of bundles.slice(0, 5)) {
      console.log(`   ${bundle.id}: ${bundle.wallets.length} wallets, ${formatPercent(bundle.supplyPercentage)} of supply`);
    }
    if (bundles.length > 5) {
      console.log(chalk.gray(`   ... and ${bundles.length - 5} more bundles`));
    }
    console.log();
  }

  // Dev activity
  if (devActivity.hasSold) {
    console.log(chalk.bold("   Dev Wallet Activity"));
    console.log(`   Sold: ${formatPercent(devActivity.soldPercentage)} of total supply`);
    console.log(`   Sell transactions: ${devActivity.sellTransactions.length}`);
    if (devActivity.firstSellTimestamp) {
      const minutesAfterLaunch = (devActivity.firstSellTimestamp - metadata.createdAt) / 60_000;
      console.log(`   First sell: ${minutesAfterLaunch.toFixed(0)} minutes after launch`);
    }
    console.log();
  }

  // Filter settings that would have caught this
  if (analysis.filterSettings) {
    console.log(chalk.bold("   Filter Settings That Would Reject This Token"));
    console.log(`   Max Bundle %:       ${formatPercent(analysis.filterSettings.maxBundlePercentage)}`);
    console.log(`   Max Dev Sold %:     ${formatPercent(analysis.filterSettings.maxDevSoldPercentage)}`);
    console.log(`   Min Buy/Sell Ratio: ${analysis.filterSettings.minBuySellRatio.toFixed(2)}x`);
    console.log(`   Max Top 10 %:       ${formatPercent(analysis.filterSettings.maxTop10HolderPercentage)}`);
    console.log(`   Min Wallets 10m:    ${analysis.filterSettings.minUniqueWallets10Min}`);
    console.log();
  }

  console.log(chalk.gray(`   Analysis completed in ${(analysis.analysisDurationMs / 1000).toFixed(1)}s`));
}

async function submitToCommunity(analysis: AnalysisResult, config: J33TConfig): Promise<void> {
  if (!config.centralApiUrl) return;

  const submission: CommunitySubmission = {
    tokenCA: analysis.tokenCA,
    analyzedAt: analysis.analyzedAt,
    patternType: "negative",
    signals: analysis.signals,
    scores: analysis.scores,
    filterSettings: analysis.filterSettings,
    clientVersion: VERSION,
  };

  try {
    const response = await fetch(`${config.centralApiUrl}/api/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission, apiKey: config.intelApiKey, patterns: analysis.detailedPatterns }),
    });

    if (response.ok) {
      console.log(chalk.green("   ✅ Rugpull pattern submitted to community database"));
    }
  } catch {
    console.log(chalk.yellow("   ⚠️  Could not reach central API"));
  }
}
