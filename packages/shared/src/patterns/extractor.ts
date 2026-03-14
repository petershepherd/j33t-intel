/**
 * Detailed Pattern Extractor
 * 
 * Extracts behavioral patterns from parsed transactions
 * for AI training. No wallet addresses — only behavior.
 */

export interface ParsedTx {
  timestamp: number;
  slot: number;
  type: string;
  signer: string;
  tokenAmount: number;
  solAmount: number;
}

export interface DetailedPatterns {
  // First 5 minutes
  first_5min_total_txs: number;
  first_5min_buy_count: number;
  first_5min_sell_count: number;
  first_5min_unique_buyers: number;
  first_5min_unique_sellers: number;
  first_5min_total_sol_volume: number;
  first_5min_avg_buy_size_sol: number;
  first_5min_largest_buy_sol: number;

  // First 30 seconds
  first_30s_buy_count: number;
  first_30s_unique_buyers: number;
  first_30s_total_sol: number;
  first_30s_slots_used: number;
  first_30s_max_buys_per_slot: number;

  // First 60 seconds
  first_60s_buy_count: number;
  first_60s_unique_buyers: number;
  first_60s_sell_count: number;

  // Bundle behavior
  bundle_count: number;
  bundle_total_wallets: number;
  bundle_avg_wallets_per_bundle: number;
  bundle_largest_wallet_count: number;
  bundle_first_bundle_time_sec: number;
  bundle_avg_buy_size_sol: number;
  bundle_total_sol_spent: number;
  bundle_slots_span: number;
  bundle_pct_of_early_buys: number;

  // Dev wallet timeline
  dev_first_action: string | null;
  dev_first_action_time_sec: number;
  dev_first_sell_time_sec: number | null;
  dev_sell_count_1h: number;
  dev_sell_pct_1h: number;
  dev_added_liquidity: number;
  dev_removed_liquidity: number;
  dev_remove_liq_time_sec: number | null;

  // Liquidity
  liq_initial_sol: number;
  liq_added_count_1h: number;
  liq_removed_count_1h: number;
  liq_removed_pct_1h: number;
  liq_first_remove_time_sec: number | null;

  // Trading velocity
  buys_per_min_avg_5min: number;
  buys_per_min_avg_30min: number;
  sell_pressure_start_time_sec: number | null;
  buy_sell_ratio_1min: number;
  buy_sell_ratio_5min: number;
  buy_sell_ratio_15min: number;
  buy_sell_ratio_60min: number;

  // Organic vs bot
  avg_time_between_buys_sec: number;
  stddev_time_between_buys: number;
  pct_buys_in_same_slot: number;
  unique_buyer_return_rate: number;

  // Token metadata
  has_freeze_authority: number;
  has_mint_authority: number;
}

export function extractDetailedPatterns(
  transactions: ParsedTx[],
  deployer: string | null,
  bundles: { wallets: string[]; txCount: number }[],
): DetailedPatterns {
  if (!transactions.length) return emptyPatterns();

  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
  const t0 = sorted[0].timestamp;

  const secSince = (ts: number) => (ts - t0) / 1000;

  // Time windows
  const w30s = sorted.filter(t => t.timestamp - t0 <= 30000);
  const w60s = sorted.filter(t => t.timestamp - t0 <= 60000);
  const w5m = sorted.filter(t => t.timestamp - t0 <= 300000);
  const w30m = sorted.filter(t => t.timestamp - t0 <= 1800000);
  const w1h = sorted.filter(t => t.timestamp - t0 <= 3600000);

  const buys = (txs: ParsedTx[]) => txs.filter(t => t.type === "buy");
  const sells = (txs: ParsedTx[]) => txs.filter(t => t.type === "sell");
  const unique = (txs: ParsedTx[]) => new Set(txs.map(t => t.signer)).size;
  const totalSol = (txs: ParsedTx[]) => txs.reduce((s, t) => s + t.solAmount, 0);

  // First 5 min
  const buys5m = buys(w5m);
  const sells5m = sells(w5m);

  // First 30s
  const buys30s = buys(w30s);
  const slots30s: Record<number, number> = {};
  buys30s.forEach(t => { slots30s[t.slot] = (slots30s[t.slot] || 0) + 1; });
  const slotsUsed30s = Object.keys(slots30s).length;
  const maxBuysPerSlot30s = slotsUsed30s > 0 ? Math.max(...Object.values(slots30s)) : 0;

  // First 60s
  const buys60s = buys(w60s);
  const sells60s = sells(w60s);

  // Bundle analysis
  const bundleTotalWallets = bundles.reduce((s, b) => s + b.wallets.length, 0);
  const largestBundle = bundles.reduce((max, b) => Math.max(max, b.wallets.length), 0);
  const bundleWalletSet = new Set(bundles.flatMap(b => b.wallets));
  const bundleBuys = buys5m.filter(t => bundleWalletSet.has(t.signer));
  const bundleSolSpent = totalSol(bundleBuys);

  // Find first bundle timing
  let firstBundleTimeSec = 0;
  if (bundles.length > 0) {
    const bundleWallets = new Set(bundles[0].wallets);
    const firstBundleTx = sorted.find(t => bundleWallets.has(t.signer) && t.type === "buy");
    if (firstBundleTx) firstBundleTimeSec = secSince(firstBundleTx.timestamp);
  }

  // Bundle slots span
  const bundleSlots = new Set(bundleBuys.map(t => t.slot));
  const bundleSlotsArr = [...bundleSlots].sort((a, b) => a - b);
  const bundleSlotsSpan = bundleSlotsArr.length > 1 
    ? bundleSlotsArr[bundleSlotsArr.length - 1] - bundleSlotsArr[0] 
    : 0;

  // Dev wallet timeline
  const devTxs = deployer ? sorted.filter(t => t.signer === deployer) : [];
  const devFirstTx = devTxs[0];
  const devSells1h = deployer ? sells(w1h).filter(t => t.signer === deployer) : [];
  const devFirstSell = devSells1h[0];
  const devLPAdds = devTxs.filter(t => t.type === "add_liquidity");
  const devLPRemoves = devTxs.filter(t => t.type === "remove_liquidity");
  const devFirstRemove = devLPRemoves[0];

  // Total token volume for percentage calc
  const totalTokenVol = sorted.reduce((s, t) => s + t.tokenAmount, 0);
  const devSellTokens = devSells1h.reduce((s, t) => s + t.tokenAmount, 0);
  const estimatedSupply = totalTokenVol / 2;

  // Liquidity
  const lpAdds1h = w1h.filter(t => t.type === "add_liquidity");
  const lpRemoves1h = w1h.filter(t => t.type === "remove_liquidity");
  const firstLP = sorted.find(t => t.type === "add_liquidity");
  const firstRemoveLP = sorted.find(t => t.type === "remove_liquidity");

  // Trading velocity
  const buysPerMin5m = w5m.length > 0 ? buys5m.length / 5 : 0;
  const buys30m = buys(w30m);
  const buysPerMin30m = w30m.length > 0 ? buys30m.length / 30 : 0;

  // Sell pressure start: first minute where sells > buys
  let sellPressureStart: number | null = null;
  for (let min = 1; min <= 60; min++) {
    const windowStart = t0 + (min - 1) * 60000;
    const windowEnd = t0 + min * 60000;
    const minTxs = sorted.filter(t => t.timestamp >= windowStart && t.timestamp < windowEnd);
    const minBuys = minTxs.filter(t => t.type === "buy").length;
    const minSells = minTxs.filter(t => t.type === "sell").length;
    if (minSells > minBuys && minSells >= 2) {
      sellPressureStart = (min - 1) * 60;
      break;
    }
  }

  // Buy/sell ratios at different windows
  const bsr = (txs: ParsedTx[]) => {
    const b = buys(txs).length;
    const s = sells(txs).length;
    return s === 0 ? b : Math.round((b / s) * 100) / 100;
  };

  const w1m = sorted.filter(t => t.timestamp - t0 <= 60000);
  const w15m = sorted.filter(t => t.timestamp - t0 <= 900000);

  // Organic vs bot: time between consecutive buys
  const allBuys = buys(sorted);
  const timeBetweenBuys: number[] = [];
  for (let i = 1; i < allBuys.length && i < 200; i++) {
    timeBetweenBuys.push((allBuys[i].timestamp - allBuys[i - 1].timestamp) / 1000);
  }
  const avgTimeBetween = timeBetweenBuys.length > 0
    ? timeBetweenBuys.reduce((s, t) => s + t, 0) / timeBetweenBuys.length : 0;
  
  // Stddev
  const variance = timeBetweenBuys.length > 1
    ? timeBetweenBuys.reduce((s, t) => s + (t - avgTimeBetween) ** 2, 0) / timeBetweenBuys.length : 0;
  const stddev = Math.sqrt(variance);

  // Same-slot buys percentage
  const slotCounts: Record<number, number> = {};
  allBuys.forEach(t => { slotCounts[t.slot] = (slotCounts[t.slot] || 0) + 1; });
  const sameSlotBuys = Object.values(slotCounts).filter(c => c > 1).reduce((s, c) => s + c, 0);
  const pctSameSlot = allBuys.length > 0 ? sameSlotBuys / allBuys.length : 0;

  // Return buyer rate (buyers who buy more than once)
  const buyerCounts: Record<string, number> = {};
  allBuys.forEach(t => { buyerCounts[t.signer] = (buyerCounts[t.signer] || 0) + 1; });
  const totalBuyers = Object.keys(buyerCounts).length;
  const returnBuyers = Object.values(buyerCounts).filter(c => c > 1).length;
  const returnRate = totalBuyers > 0 ? returnBuyers / totalBuyers : 0;

  return {
    first_5min_total_txs: w5m.length,
    first_5min_buy_count: buys5m.length,
    first_5min_sell_count: sells5m.length,
    first_5min_unique_buyers: unique(buys5m),
    first_5min_unique_sellers: unique(sells5m),
    first_5min_total_sol_volume: Math.round(totalSol(buys5m) * 1000) / 1000,
    first_5min_avg_buy_size_sol: buys5m.length > 0 ? Math.round((totalSol(buys5m) / buys5m.length) * 1000) / 1000 : 0,
    first_5min_largest_buy_sol: buys5m.length > 0 ? Math.round(Math.max(...buys5m.map(t => t.solAmount)) * 1000) / 1000 : 0,

    first_30s_buy_count: buys30s.length,
    first_30s_unique_buyers: unique(buys30s),
    first_30s_total_sol: Math.round(totalSol(buys30s) * 1000) / 1000,
    first_30s_slots_used: slotsUsed30s,
    first_30s_max_buys_per_slot: maxBuysPerSlot30s,

    first_60s_buy_count: buys60s.length,
    first_60s_unique_buyers: unique(buys60s),
    first_60s_sell_count: sells60s.length,

    bundle_count: bundles.length,
    bundle_total_wallets: bundleTotalWallets,
    bundle_avg_wallets_per_bundle: bundles.length > 0 ? Math.round((bundleTotalWallets / bundles.length) * 10) / 10 : 0,
    bundle_largest_wallet_count: largestBundle,
    bundle_first_bundle_time_sec: Math.round(firstBundleTimeSec * 10) / 10,
    bundle_avg_buy_size_sol: bundleBuys.length > 0 ? Math.round((bundleSolSpent / bundleBuys.length) * 1000) / 1000 : 0,
    bundle_total_sol_spent: Math.round(bundleSolSpent * 1000) / 1000,
    bundle_slots_span: bundleSlotsSpan,
    bundle_pct_of_early_buys: buys5m.length > 0 ? Math.round((bundleBuys.length / buys5m.length) * 1000) / 10 : 0,

    dev_first_action: devFirstTx?.type || null,
    dev_first_action_time_sec: devFirstTx ? Math.round(secSince(devFirstTx.timestamp) * 10) / 10 : 0,
    dev_first_sell_time_sec: devFirstSell ? Math.round(secSince(devFirstSell.timestamp) * 10) / 10 : null,
    dev_sell_count_1h: devSells1h.length,
    dev_sell_pct_1h: estimatedSupply > 0 ? Math.round((devSellTokens / estimatedSupply) * 1000) / 10 : 0,
    dev_added_liquidity: devLPAdds.length,
    dev_removed_liquidity: devLPRemoves.length,
    dev_remove_liq_time_sec: devFirstRemove ? Math.round(secSince(devFirstRemove.timestamp) * 10) / 10 : null,

    liq_initial_sol: firstLP ? Math.round(firstLP.solAmount * 1000) / 1000 : 0,
    liq_added_count_1h: lpAdds1h.length,
    liq_removed_count_1h: lpRemoves1h.length,
    liq_removed_pct_1h: 0,
    liq_first_remove_time_sec: firstRemoveLP ? Math.round(secSince(firstRemoveLP.timestamp) * 10) / 10 : null,

    buys_per_min_avg_5min: Math.round(buysPerMin5m * 10) / 10,
    buys_per_min_avg_30min: Math.round(buysPerMin30m * 10) / 10,
    sell_pressure_start_time_sec: sellPressureStart,
    buy_sell_ratio_1min: bsr(w1m),
    buy_sell_ratio_5min: bsr(w5m),
    buy_sell_ratio_15min: bsr(w15m),
    buy_sell_ratio_60min: bsr(w1h),

    avg_time_between_buys_sec: Math.round(avgTimeBetween * 100) / 100,
    stddev_time_between_buys: Math.round(stddev * 100) / 100,
    pct_buys_in_same_slot: Math.round(pctSameSlot * 1000) / 10,
    unique_buyer_return_rate: Math.round(returnRate * 1000) / 10,

    has_freeze_authority: 0,
    has_mint_authority: 0,
  };
}

function emptyPatterns(): DetailedPatterns {
  return {
    first_5min_total_txs: 0, first_5min_buy_count: 0, first_5min_sell_count: 0,
    first_5min_unique_buyers: 0, first_5min_unique_sellers: 0, first_5min_total_sol_volume: 0,
    first_5min_avg_buy_size_sol: 0, first_5min_largest_buy_sol: 0,
    first_30s_buy_count: 0, first_30s_unique_buyers: 0, first_30s_total_sol: 0,
    first_30s_slots_used: 0, first_30s_max_buys_per_slot: 0,
    first_60s_buy_count: 0, first_60s_unique_buyers: 0, first_60s_sell_count: 0,
    bundle_count: 0, bundle_total_wallets: 0, bundle_avg_wallets_per_bundle: 0,
    bundle_largest_wallet_count: 0, bundle_first_bundle_time_sec: 0,
    bundle_avg_buy_size_sol: 0, bundle_total_sol_spent: 0, bundle_slots_span: 0,
    bundle_pct_of_early_buys: 0,
    dev_first_action: null, dev_first_action_time_sec: 0,
    dev_first_sell_time_sec: null, dev_sell_count_1h: 0, dev_sell_pct_1h: 0,
    dev_added_liquidity: 0, dev_removed_liquidity: 0, dev_remove_liq_time_sec: null,
    liq_initial_sol: 0, liq_added_count_1h: 0, liq_removed_count_1h: 0,
    liq_removed_pct_1h: 0, liq_first_remove_time_sec: null,
    buys_per_min_avg_5min: 0, buys_per_min_avg_30min: 0,
    sell_pressure_start_time_sec: null,
    buy_sell_ratio_1min: 0, buy_sell_ratio_5min: 0,
    buy_sell_ratio_15min: 0, buy_sell_ratio_60min: 0,
    avg_time_between_buys_sec: 0, stddev_time_between_buys: 0,
    pct_buys_in_same_slot: 0, unique_buyer_return_rate: 0,
    has_freeze_authority: 0, has_mint_authority: 0,
  };
}
