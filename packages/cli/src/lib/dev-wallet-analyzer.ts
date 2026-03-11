/**
 * Dev Wallet Analyzer
 *
 * Tracks the deployer wallet's behavior:
 * - When did they sell?
 * - How much did they sell?
 * - What's their current holding?
 *
 * One of the strongest rugpull signals is early dev selling.
 */

import type { ParsedTransaction, DevWalletActivity, WalletAddress } from "@j33t-intel/shared";

/**
 * Analyze the dev (deployer) wallet's activity from parsed transactions.
 */
export function analyzeDevWallet(
  transactions: ParsedTransaction[],
  deployer: WalletAddress,
  totalSupply: number,
): DevWalletActivity {
  // Find all transactions involving the deployer
  const devTxs = transactions.filter((tx) => tx.signer === deployer);

  // Track token balance changes
  let tokensReceived = 0;
  let tokensSold = 0;
  let firstSellTimestamp: number | undefined;
  const sellTransactions: ParsedTransaction[] = [];

  for (const tx of devTxs) {
    switch (tx.type) {
      case "buy":
      case "transfer":
        // Dev acquiring tokens (initial mint, transfers in)
        tokensReceived += tx.tokenAmount;
        break;

      case "sell":
        tokensSold += tx.tokenAmount;
        sellTransactions.push(tx);
        if (!firstSellTimestamp) {
          firstSellTimestamp = tx.timestamp;
        }
        break;

      case "add_liquidity":
        // Adding liquidity is not the same as selling — track separately
        // but for holder percentage calculation, tokens leave the wallet
        tokensReceived -= tx.tokenAmount;
        break;

      case "remove_liquidity":
        tokensReceived += tx.tokenAmount;
        break;
    }
  }

  // Also check for transactions where deployer is the recipient (not signer)
  // This handles initial token minting and transfers to the deployer
  const incomingTxs = transactions.filter(
    (tx) => tx.signer !== deployer, // Not initiated by deployer
  );

  // The deployer often receives the initial supply via the token creation tx
  // which may not have them as the signer. We estimate peak holding from
  // the total supply if no explicit receives are found.
  const estimatedPeakHolding = totalSupply > 0
    ? Math.max(tokensReceived, totalSupply) // Deployer likely had full supply initially
    : tokensReceived;

  const peakHoldingPercentage = totalSupply > 0
    ? (estimatedPeakHolding / totalSupply) * 100
    : 0;

  const currentHolding = Math.max(0, estimatedPeakHolding - tokensSold);
  const currentHoldingPercentage = totalSupply > 0
    ? (currentHolding / totalSupply) * 100
    : 0;

  const soldPercentage = totalSupply > 0
    ? (tokensSold / totalSupply) * 100
    : 0;

  return {
    wallet: deployer,
    peakHoldingPercentage: Math.min(100, peakHoldingPercentage),
    currentHoldingPercentage: Math.min(100, currentHoldingPercentage),
    hasSold: tokensSold > 0,
    firstSellTimestamp,
    soldPercentage: Math.min(100, soldPercentage),
    sellTransactions,
  };
}

/**
 * Calculate how quickly the dev sold after token creation.
 * Returns minutes from creation to first sell, or null if no sell.
 */
export function getDevSellDelay(
  devActivity: DevWalletActivity,
  tokenCreatedAt: number,
): number | null {
  if (!devActivity.firstSellTimestamp) return null;
  return (devActivity.firstSellTimestamp - tokenCreatedAt) / 60_000;
}

/**
 * Identify the deployer wallet from transaction history.
 * The deployer is typically the signer of the first transaction
 * (token creation or first liquidity add).
 */
export function identifyDeployer(transactions: ParsedTransaction[]): WalletAddress | null {
  if (transactions.length === 0) return null;

  // Sort by timestamp to find the earliest transaction
  const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

  // The first transaction's signer is likely the deployer
  // Especially if it's an add_liquidity or the very first buy
  const first = sorted[0];

  // If the first tx is add_liquidity, that's almost certainly the deployer
  if (first.type === "add_liquidity") {
    return first.signer;
  }

  // If the first tx is a transfer, it might be the initial distribution
  if (first.type === "transfer") {
    return first.signer;
  }

  // Otherwise, look for the first add_liquidity transaction
  const firstLP = sorted.find((tx) => tx.type === "add_liquidity");
  if (firstLP) {
    return firstLP.signer;
  }

  // Fallback: first transaction signer
  return first.signer;
}
