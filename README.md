# J33T Intel 🐾

**On-Chain Intelligence Platform for Solana Meme Tokens**

J33T Intel is an open-source, community-driven intelligence platform designed to identify high-potential Solana meme tokens in their earliest stages — and filter out rugpulls before they happen.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/petershepherd/j33t-intel.git
cd j33t-intel

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Set up your API keys
cp .env.example .env
# Edit .env with your Helius + AI API keys

# Run a backtest
pnpm --filter @j33t-intel/cli start backtest <TOKEN_CA>
```

## Project Structure

```
j33t-intel/
├── packages/
│   ├── shared/          # Types, scoring engine, validation, utilities
│   │   └── src/
│   │       ├── types/       # TypeScript types (token, analysis, tiers, config, api)
│   │       ├── scoring/     # Scoring engine with configurable weights
│   │       ├── validation/  # Input validation for submissions & config
│   │       └── utils/       # Formatters, rate limiter, helpers
│   ├── cli/             # Node.js CLI tool
│   │   └── src/
│   │       ├── commands/    # backtest, rugcheck, scan, config
│   │       ├── services/    # Helius, DexScreener, AI service wrappers
│   │       ├── lib/         # Core analysis logic
│   │       └── config/      # .env loader
│   └── worker/          # Cloudflare Worker (Central API)
│       └── src/
│           ├── routes/      # API endpoints (submissions, patterns, tier, leaderboard)
│           └── db/          # D1 migrations
├── docs/                # Documentation
├── .env.example         # API key template
└── pnpm-workspace.yaml  # Monorepo config
```

## How It Works

1. **Backtester Mode** — Input a successful token CA. The system reconstructs its first 1-2 hours, finds when it could have been detected under $100K MCap, and outputs optimal filter settings as JSON.

2. **Rugpull Pattern Mode** — Input a known rugpull CA. The system extracts pre-rug behavioral signatures that feed the negative training set.

3. **Live Scanner** — Analyze any token in real-time using detection signals and the scoring engine.

4. **Community Database** — Opt-in to contribute anonymized analysis results. Every submission improves the shared pattern library.

## Detection Signals

| Signal | What We Measure |
|--------|----------------|
| Liquidity Growth Rate | Organic growth vs. artificial injection |
| Buy/Sell Ratio | Sustained buy pressure in first 5-60 minutes |
| Bundle Detection | Coordinated wallets from common funding source |
| Wallet Concentration | Top holder distribution |
| Dev Wallet Behavior | Has deployer sold? When? How much? |
| Liquidity Lock Status | Is liquidity locked and for how long? |
| Volume/MCap Ratio | Active trading relative to market cap |
| Price Momentum | Gradual growth vs. artificial spike |
| Freeze/Mint Authority | Can dev freeze wallets or mint new supply? |
| Transaction Timing | Suspicious clustering in time windows |

## Tech Stack

- **TypeScript** — Full type safety across CLI and API
- **pnpm workspaces** — Monorepo with shared packages
- **Helius API** — Solana transaction history
- **DexScreener API** — Market data
- **Cloudflare Workers + D1** — Central API & database
- **Claude/OpenAI** — AI-powered pattern analysis
- **Vitest** — Testing

## $J33T Token Tiers

Access to advanced features is gated by $J33T token holdings:

| Tier | $J33T Required | Analyses/Day |
|------|---------------|-------------|
| Street Stray | 0 | 1 |
| First Sniff | 10,000 | 2 |
| Loud Woofer | 50,000 | 3 |
| Nose Certified | 100,000 | 5 |
| Pack Runner | 500,000 | 8 |
| Paws of Steel | 1,000,000 | 13 |
| Top Dog | 5,000,000 | 21 |

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## Disclaimer

J33T Intel is a research and analysis tool. Nothing constitutes financial advice. Meme token trading carries extreme risk. Always do your own research. NFA. DYOR. 🐾

## License

MIT — see [LICENSE](LICENSE)
