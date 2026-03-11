/**
 * Config command — show/initialize configuration
 */

import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_TEMPLATE = `# J33T Intel Configuration
# Copy this to .env and fill in your API keys

# === REQUIRED ===

# Helius API key — get one at https://helius.dev
HELIUS_API_KEY=

# AI Provider: "anthropic" or "openai"
AI_PROVIDER=anthropic

# AI API Key (Anthropic or OpenAI)
AI_API_KEY=

# === OPTIONAL ===

# AI model to use (default: claude-sonnet-4-20250514)
# AI_MODEL=claude-sonnet-4-20250514

# Your $J33T wallet address (for tier verification)
# J33T_WALLET_ADDRESS=

# Enable community data contribution (default: false)
# CONTRIBUTE_TO_COMMUNITY=false

# Central API URL (default: https://api.j33t.com)
# CENTRAL_API_URL=https://api.j33t.com

# Request timeout in ms (default: 30000)
# REQUEST_TIMEOUT_MS=30000

# DexScreener rate limit per minute (default: 300)
# DEXSCREENER_RATE_LIMIT=300

# Cache directory (default: .j33t-cache)
# CACHE_DIR=.j33t-cache

# Verbose logging (default: false)
# VERBOSE=false
`;

interface ConfigOptions {
  init?: boolean;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  if (options.init) {
    const envPath = resolve(process.cwd(), ".env");

    if (existsSync(envPath)) {
      console.log("⚠️  .env file already exists. Delete it first if you want to re-initialize.");
      return;
    }

    writeFileSync(envPath, ENV_TEMPLATE, "utf-8");
    console.log("✅ Created .env file. Edit it with your API keys:");
    console.log(`   ${envPath}`);
    return;
  }

  // Show current config (masked)
  console.log("🐾 J33T Intel — Configuration");
  console.log();
  console.log("Run 'j33t config --init' to create a new .env file.");
}
