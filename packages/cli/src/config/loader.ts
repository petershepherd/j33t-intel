import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import type { J33TConfig, AIProvider } from "@j33t-intel/shared";
import { CONFIG_DEFAULTS, validateConfig } from "@j33t-intel/shared";

interface CommandOptions {
  verbose?: boolean;
  contribute?: boolean;
}

export async function loadConfig(options: CommandOptions = {}): Promise<J33TConfig> {
  loadDotenv({ path: resolve(process.cwd(), ".env") });

  const config: J33TConfig = {
    heliusApiKey: process.env.HELIUS_API_KEY ?? "",
    aiProvider: (process.env.AI_PROVIDER as AIProvider) ?? CONFIG_DEFAULTS.aiProvider,
    aiApiKey: process.env.AI_API_KEY ?? "",
    aiModel: process.env.AI_MODEL ?? CONFIG_DEFAULTS.aiModel,
    centralApiUrl: process.env.CENTRAL_API_URL ?? CONFIG_DEFAULTS.centralApiUrl,
    contributeToCommunity: options.contribute ?? process.env.CONTRIBUTE_TO_COMMUNITY === "true",
    walletAddress: process.env.J33T_WALLET_ADDRESS,
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS) || CONFIG_DEFAULTS.requestTimeoutMs,
    cacheDir: process.env.CACHE_DIR ?? CONFIG_DEFAULTS.cacheDir,
    dexScreenerRateLimit: Number(process.env.DEXSCREENER_RATE_LIMIT) || CONFIG_DEFAULTS.dexScreenerRateLimit,
    intelApiKey: process.env.J33T_INTEL_KEY,
    verbose: options.verbose ?? process.env.VERBOSE === "true",
  };

  const validation = validateConfig(config);
  if (!validation.valid) {
    console.error("Configuration errors:");
    validation.errors.forEach((e) => console.error(`   - ${e}`));
    console.error('\nRun "j33t config --init" to create a .env file.');
    process.exit(1);
  }

  return config;
}
