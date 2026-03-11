/**
 * Transaction Parser
 *
 * Converts raw Helius enhanced transactions into our internal
 * ParsedTransaction format. Classifies each transaction as
 * buy, sell, add_liquidity, remove_liquidity, or transfer.
 */

import type { ParsedTransaction, TransactionType, TokenCA } from "@j33t-intel/shared";
import type { HeliusTransaction } from "../services/helius.js";

/** Known DEX program IDs on Solana */
const DEX_PROGRAMS = new Set([
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",  // Orca Whirlpool
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP", // Orca Legacy
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",  // Jupiter v6
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  // Pump.fun
]);

/** Known liquidity pool programs */
const LP_PROGRAMS = new Set([
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM (also handles LP)
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",  // Meteora
]);

/** SOL/WSOL mint address */
const SOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Parse a batch of Helius transactions for a specific token.
 * Returns classified ParsedTransactions sorted by timestamp (oldest first).
 */
export function parseTransactions(
  heliusTxs: HeliusTransaction[],
  tokenMint: TokenCA,
): ParsedTransaction[] {
  const parsed: ParsedTransaction[] = [];

  for (const tx of heliusTxs) {
    const result = parseTransaction(tx, tokenMint);
    if (result) {
      parsed.push(result);
    }
  }

  // Sort by timestamp, oldest first
  parsed.sort((a, b) => a.timestamp - b.timestamp);

  return parsed;
}

/**
 * Parse a single Helius transaction.
 * Returns null if the transaction is not relevant to the token.
 */
function parseTransaction(
  tx: HeliusTransaction,
  tokenMint: TokenCA,
): ParsedTransaction | null {
  // Find token transfers involving our mint
  const tokenTransfers = tx.tokenTransfers?.filter(
    (t) => t.mint === tokenMint,
  ) ?? [];

  // Find SOL transfers
  const solTransfers = tx.nativeTransfers ?? [];

  if (tokenTransfers.length === 0 && !isLiquidityTransaction(tx)) {
    return null; // Not relevant to our token
  }

  // Classify the transaction type
  const type = classifyTransaction(tx, tokenTransfers, tokenMint);

  // Calculate token and SOL amounts
  const tokenAmount = tokenTransfers.reduce(
    (sum, t) => sum + Math.abs(t.tokenAmount),
    0,
  );

  const solAmount = solTransfers.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0,
  ) / 1e9; // Convert lamports to SOL

  return {
    signature: tx.signature,
    timestamp: tx.timestamp * 1000, // Helius returns seconds, we use ms
    slot: tx.slot,
    signer: tx.feePayer,
    type,
    tokenAmount,
    solAmount,
  };
}

/**
 * Classify a transaction type based on its characteristics.
 */
function classifyTransaction(
  tx: HeliusTransaction,
  tokenTransfers: HeliusTransaction["tokenTransfers"],
  tokenMint: TokenCA,
): TransactionType {
  const heliusType = tx.type?.toUpperCase() ?? "";
  const source = tx.source?.toUpperCase() ?? "";

  // Check for liquidity events first
  if (
    heliusType.includes("ADD_LIQUIDITY") ||
    heliusType.includes("CREATE_POOL") ||
    tx.description?.toLowerCase().includes("add liquidity")
  ) {
    return "add_liquidity";
  }

  if (
    heliusType.includes("REMOVE_LIQUIDITY") ||
    heliusType.includes("WITHDRAW") ||
    tx.description?.toLowerCase().includes("remove liquidity")
  ) {
    return "remove_liquidity";
  }

  // Check for swaps (buys and sells)
  if (
    heliusType === "SWAP" ||
    source === "RAYDIUM" ||
    source === "ORCA" ||
    source === "JUPITER" ||
    source === "PUMP_FUN"
  ) {
    return classifySwapDirection(tx, tokenTransfers, tokenMint);
  }

  // Check for transfers
  if (heliusType === "TRANSFER" || tokenTransfers.length > 0) {
    // If it's a swap-like transfer on a DEX, classify as buy/sell
    if (hasSOLCounterpart(tx) && tokenTransfers.length > 0) {
      return classifySwapDirection(tx, tokenTransfers, tokenMint);
    }
    return "transfer";
  }

  // Default: check if there's a SOL counterpart to determine buy/sell
  if (tokenTransfers.length > 0 && hasSOLCounterpart(tx)) {
    return classifySwapDirection(tx, tokenTransfers, tokenMint);
  }

  return "transfer";
}

/**
 * Determine if a swap is a buy or sell of the target token.
 * Buy = SOL goes out, token comes in (to the signer)
 * Sell = token goes out, SOL comes in (to the signer)
 */
function classifySwapDirection(
  tx: HeliusTransaction,
  tokenTransfers: HeliusTransaction["tokenTransfers"],
  _tokenMint: TokenCA,
): "buy" | "sell" {
  const signer = tx.feePayer;

  // Check token balance changes from accountData
  for (const account of tx.accountData ?? []) {
    if (account.account === signer) {
      for (const change of account.tokenBalanceChanges ?? []) {
        if (change.mint === _tokenMint) {
          const amount = parseFloat(change.rawTokenAmount.tokenAmount);
          if (amount > 0) return "buy";   // Signer received tokens
          if (amount < 0) return "sell";  // Signer sent tokens
        }
      }
    }
  }

  // Fallback: check token transfer direction
  for (const transfer of tokenTransfers) {
    if (transfer.toUserAccount === signer) return "buy";
    if (transfer.fromUserAccount === signer) return "sell";
  }

  // If we still can't tell, default to buy
  return "buy";
}

/**
 * Check if a transaction involves SOL transfers (indicating a swap).
 */
function hasSOLCounterpart(tx: HeliusTransaction): boolean {
  // Check native transfers
  if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
    const significantTransfers = tx.nativeTransfers.filter(
      (t) => Math.abs(t.amount) > 10_000_000, // > 0.01 SOL
    );
    if (significantTransfers.length > 0) return true;
  }

  // Check for WSOL token transfers
  if (tx.tokenTransfers) {
    const wsolTransfers = tx.tokenTransfers.filter(
      (t) => t.mint === SOL_MINT,
    );
    if (wsolTransfers.length > 0) return true;
  }

  return false;
}

/**
 * Check if a transaction is likely a liquidity-related transaction.
 */
function isLiquidityTransaction(tx: HeliusTransaction): boolean {
  const type = tx.type?.toUpperCase() ?? "";
  return (
    type.includes("LIQUIDITY") ||
    type.includes("CREATE_POOL") ||
    type.includes("WITHDRAW")
  );
}

/**
 * Get unique wallet addresses from parsed transactions.
 */
export function getUniqueWallets(transactions: ParsedTransaction[]): Set<string> {
  return new Set(transactions.map((tx) => tx.signer));
}

/**
 * Get unique wallets within a time window from token creation.
 */
export function getUniqueWalletsInWindow(
  transactions: ParsedTransaction[],
  windowMinutes: number,
): Set<string> {
  if (transactions.length === 0) return new Set();

  const firstTxTime = transactions[0].timestamp;
  const windowEnd = firstTxTime + windowMinutes * 60_000;

  const walletsInWindow = transactions
    .filter((tx) => tx.timestamp <= windowEnd && tx.type === "buy")
    .map((tx) => tx.signer);

  return new Set(walletsInWindow);
}

/**
 * Calculate buy/sell ratio within a time window.
 */
export function calculateBuySellRatio(
  transactions: ParsedTransaction[],
  windowMinutes: number,
): number {
  if (transactions.length === 0) return 0;

  const firstTxTime = transactions[0].timestamp;
  const windowEnd = firstTxTime + windowMinutes * 60_000;

  const inWindow = transactions.filter((tx) => tx.timestamp <= windowEnd);
  const buys = inWindow.filter((tx) => tx.type === "buy").length;
  const sells = inWindow.filter((tx) => tx.type === "sell").length;

  if (sells === 0) return buys > 0 ? buys : 0;
  return buys / sells;
}
