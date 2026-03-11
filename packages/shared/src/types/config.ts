export type AIProvider = "anthropic" | "openai" | "groq";

export interface J33TConfig {
  heliusApiKey: string;
  dexScreenerRateLimit?: number;
  aiProvider?: AIProvider;
  aiApiKey?: string;
  aiModel?: string;
  centralApiUrl?: string;
  contributeToCommunity?: boolean;
  walletAddress?: string;
  requestTimeoutMs?: number;
  cacheDir?: string;
  verbose?: boolean;
}

export const CONFIG_DEFAULTS: Partial<J33TConfig> = {
  aiProvider: "groq",
  aiModel: "llama-3.3-70b-versatile",
  centralApiUrl: "https://j33t-intel-api.juhasz-peter1986.workers.dev",
  contributeToCommunity: false,
  requestTimeoutMs: 30_000,
  cacheDir: ".j33t-cache",
  verbose: false,
  dexScreenerRateLimit: 300,
};

export const REQUIRED_CONFIG_KEYS: (keyof J33TConfig)[] = [
  "heliusApiKey",
];
