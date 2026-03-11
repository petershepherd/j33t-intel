/**
 * Core token data types for J33T Intel
 * These represent the fundamental on-chain data we work with.
 */

/** Solana token contract address */
export type TokenCA = string;

/** Solana wallet address */
export type WalletAddress = string;

/** Unix timestamp in milliseconds */
export type Timestamp = number;

/** SOL amount in lamports */
export type Lamports = number;

/** Token metadata from on-chain + DexScreener */
export interface TokenMetadata {
  ca: TokenCA;
  name: string;
  symbol: string;
  decimals: number;
  /** Deployer wallet address */
  deployer: WalletAddress;
  /** Token creation timestamp */
  createdAt: Timestamp;
  /** Has freeze authority enabled? */
  hasFreezeAuthority: boolean;
  /** Has mint authority enabled? (can mint more supply) */
  hasMintAuthority: boolean;
  /** Social links if available */
  socials?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

/** A single parsed transaction relevant to token analysis */
export interface ParsedTransaction {
  signature: string;
  timestamp: Timestamp;
  /** Block slot number */
  slot: number;
  /** Wallet that initiated the transaction */
  signer: WalletAddress;
  type: TransactionType;
  /** Token amount involved */
  tokenAmount: number;
  /** SOL amount involved */
  solAmount: number;
  /** Was this part of a detected bundle? */
  bundleId?: string;
}

export type TransactionType = "buy" | "sell" | "add_liquidity" | "remove_liquidity" | "transfer";

/** Aggregated market data at a point in time */
export interface MarketSnapshot {
  timestamp: Timestamp;
  /** Market cap in USD */
  mcapUsd: number;
  /** Price in USD */
  priceUsd: number;
  /** Liquidity in USD */
  liquidityUsd: number;
  /** 24h volume in USD */
  volumeUsd: number;
}

/** Bundle detection result — group of coordinated wallets */
export interface DetectedBundle {
  id: string;
  /** Wallets in this bundle */
  wallets: WalletAddress[];
  /** Common funding source (if detected) */
  fundingSource?: WalletAddress;
  /** Total token amount bought by bundle */
  totalTokensBought: number;
  /** Percentage of total supply held by bundle */
  supplyPercentage: number;
  /** All transactions in this bundle */
  transactions: ParsedTransaction[];
}

/** Dev wallet activity summary */
export interface DevWalletActivity {
  wallet: WalletAddress;
  /** Total supply percentage held at peak */
  peakHoldingPercentage: number;
  /** Current supply percentage held */
  currentHoldingPercentage: number;
  /** Has the dev sold any tokens? */
  hasSold: boolean;
  /** When did first sell happen? */
  firstSellTimestamp?: Timestamp;
  /** Total percentage of supply sold */
  soldPercentage: number;
  /** Sell transactions */
  sellTransactions: ParsedTransaction[];
}
