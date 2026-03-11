# Configuration Guide

J33T Intel is configured through a `.env` file in the project root. This file contains your API keys and preferences.

---

## Quick Setup

```bash
cp .env.example .env
```

Then edit `.env` with your preferred text editor.

---

## All Settings

### Required

| Setting | Description | Example |
|---------|-------------|---------|
| `HELIUS_API_KEY` | Your Helius API key for Solana data | `abc123def456` |

This is the only setting you **must** provide. Everything else has sensible defaults.

### AI Settings (Optional)

| Setting | Default | Description |
|---------|---------|-------------|
| `AI_PROVIDER` | *(none)* | AI provider: `anthropic`, `openai`, or `groq` |
| `AI_API_KEY` | *(none)* | API key for the chosen AI provider |
| `AI_MODEL` | *(auto)* | Model to use (e.g. `llama-3.3-70b-versatile` for Groq) |

AI is not required for backtesting or rugchecking. The scoring engine is rule-based. AI will be used in future phases for natural language analysis and pattern recognition.

### Community Database (Optional)

| Setting | Default | Description |
|---------|---------|-------------|
| `CONTRIBUTE_TO_COMMUNITY` | `false` | Send anonymized results to the shared database |
| `CENTRAL_API_URL` | `https://api.j33t.com` | URL of the central J33T Intel API |

When you opt in to community contribution, **only these anonymized fields are sent**: token address, pattern type, detection signals, scores, and filter settings. **Never sent**: your API keys, wallet address, IP address, or any personal data.

### Token Verification (Optional)

| Setting | Default | Description |
|---------|---------|-------------|
| `J33T_WALLET_ADDRESS` | *(none)* | Your Solana wallet address for tier verification |

If you hold $J33T tokens, providing your wallet address unlocks higher tiers with more analyses per day and advanced features.

### Advanced Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `REQUEST_TIMEOUT_MS` | `30000` | API request timeout in milliseconds |
| `DEXSCREENER_RATE_LIMIT` | `300` | DexScreener requests per minute |
| `CACHE_DIR` | `.j33t-cache` | Directory for caching API responses |
| `VERBOSE` | `false` | Show detailed progress during analysis |

---

## Example .env File

```env
# === REQUIRED ===
HELIUS_API_KEY=your_actual_helius_key_here

# === OPTIONAL ===
# AI_PROVIDER=groq
# AI_API_KEY=your_groq_key_here

# CONTRIBUTE_TO_COMMUNITY=false
# VERBOSE=false
```

---

## Security

The `.env` file is listed in `.gitignore`, which means:

- **Git will never upload it** to GitHub or any remote repository
- Only the `.env.example` file (with placeholder values) is shared publicly
- Your API keys exist only on your local machine

If you're using the Cloudflare Worker (for the central API), secrets are stored using `wrangler secret put` — they're encrypted and never visible in the code or dashboard.

### What if I accidentally commit my .env?

If you ever accidentally upload your `.env` file:

1. **Immediately rotate your API keys** (generate new ones on Helius/AI provider)
2. Remove the file from Git history:
   ```bash
   git rm --cached .env
   git commit -m "remove .env from tracking"
   git push
   ```
3. Update your local `.env` with the new keys

---

## Command-Line Options

Some settings can also be passed as command-line flags, which override `.env` values:

```bash
# Enable verbose output for this run only
node packages/cli/dist/index.js backtest <TOKEN_CA> --verbose

# Submit results to community database for this run
node packages/cli/dist/index.js backtest <TOKEN_CA> --contribute

# Save output to a specific file
node packages/cli/dist/index.js backtest <TOKEN_CA> --output my-analysis.json
```
