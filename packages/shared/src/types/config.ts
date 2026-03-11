/**
 * Configuration types for J33T Intel CLI
 */

/** API provider for AI analysis */
export type AIProvider = "anthropic" | "openai";

/** CLI configuration loaded from .env */
export interface J33TConfig {
  /** Helius API key for Solana transaction history */
  heliusApiKey: string;
  /** DexScreener doesn't need a key but we support rate limit config */
  dexScreenerRateLimit?: number;
  /** AI provider to use */
  aiProvider: AIProvider;
  /** AI API key (Claude or OpenAI) */
  aiApiKey: string;
  /** AI model to use */
  aiModel?: string;
  /** Central J33T Intel API URL (for community submissions) */
  centralApiUrl?: string;
  /** Enable community data contribution */
  contributeToCommunity?: boolean;
  /** $J33T wallet address (for tier verification) */
  walletAddress?: string;
  /** Request timeout in ms */
  requestTimeoutMs?: number;
  /** Cache directory for API responses */
  cacheDir?: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

/** Default configuration values */
export const CONFIG_DEFAULTS: Partial<J33TConfig> = {
  aiProvider: "anthropic",
  aiModel: "claude-sonnet-4-20250514",
  centralApiUrl: "https://api.j33t.com",
  contributeToCommunity: false,
  requestTimeoutMs: 30_000,
  cacheDir: ".j33t-cache",
  verbose: false,
  dexScreenerRateLimit: 300, // requests per minute
};

/** Required config keys that must be set */
export const REQUIRED_CONFIG_KEYS: (keyof J33TConfig)[] = [
  "heliusApiKey",
  "aiProvider",
  "aiApiKey",
];
