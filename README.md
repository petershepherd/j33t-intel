# J33T Intel 🐾

**Open-source on-chain intelligence platform for Solana meme tokens.**

J33T Intel analyzes Solana token transactions to detect promising early launches and filter out rugpulls — before they happen.

---

## What Does It Do?

You give it a Solana token address. It fetches the transaction history, analyzes 14 different signals, and tells you:

- **Potential Score (0–100)** — How promising does this token look?
- **Rugpull Risk Score (0–100)** — How likely is it to be a scam?
- **Optimal Filter Settings** — What scanner settings would have caught this token early?

Everything runs on your machine. Your API keys stay local. Nothing is shared unless you explicitly opt in.

### Example Output

```
━━━ Bonk (Bonk) ━━━

   Pattern: POSITIVE

   Scores
   Potential:    64/100 ████████████░░░░░░░░
   Rug Risk:     27/100 █████░░░░░░░░░░░░░░░

   Key Signals
   Buy/Sell Ratio:     2.36x
   Bundle %:           0.0%
   Dev Sold:           0.0%
   Timing Suspicion:   0%
   Unique Wallets 10m: 38
```

---

## Quick Start

> **New to coding?** See the full [Setup Guide](docs/SETUP.md) with step-by-step instructions for Mac, Windows, and Linux.

```bash
git clone https://github.com/petershepherd/j33t-intel.git
cd j33t-intel
pnpm install
pnpm build
cp .env.example .env       # then edit .env with your Helius API key
```

Run your first analysis:

```bash
node packages/cli/dist/index.js backtest <TOKEN_ADDRESS> --verbose
```

---

## Three Modes

### 1. Backtest — Learn from winners
Input a successful token. J33T Intel reconstructs its early trading history and finds the optimal scanner settings that would have detected it under $100K market cap.

```bash
node packages/cli/dist/index.js backtest <TOKEN_CA> --verbose
```

### 2. Rugcheck — Learn from scams
Input a known rugpull. The system extracts the behavioral signatures from the pre-rug phase, creating patterns that help detect future scams.

```bash
node packages/cli/dist/index.js rugcheck <TOKEN_CA> --verbose
```

### 3. Live Scan — Analyze any token (coming soon)
Real-time analysis of any active token using the scoring engine.

---

## What It Analyzes (14 Signals)

| Signal | What It Means |
|--------|--------------|
| **Buy/Sell Ratio** | More buys than sells = healthy interest |
| **Bundle Detection** | Coordinated wallets buying together = manipulation |
| **Top 10 Holders** | If a few wallets hold most supply = dump risk |
| **Dev Wallet** | Did the creator sell? How fast? How much? |
| **Liquidity Lock** | Locked liquidity = harder to rugpull |
| **Freeze Authority** | Can the dev freeze your tokens? |
| **Mint Authority** | Can the dev print unlimited new tokens? |
| **Volume/MCap** | Active trading relative to market cap |
| **Price Momentum** | Organic growth vs artificial pump |
| **Transaction Timing** | Bot-like buying patterns in the first minutes |
| **Unique Wallets** | More real buyers early = organic interest |
| **Liquidity Growth** | How fast liquidity grows after launch |
| **Bundle Count** | Number of coordinated wallet groups |
| **Lock Duration** | How long is liquidity locked for? |

Each signal is scored 0–100, weighted, and combined into the final Potential and Risk scores.

---

## Security & Privacy

**Your API keys are never uploaded, shared, or exposed.**

- The `.env` file (where your keys live) is in `.gitignore` — Git will never upload it
- Only the `.env.example` template (with empty placeholder values) is on GitHub
- The CLI runs entirely on your machine
- Community data contribution is **opt-in only** and sends anonymized analysis results — never your keys, wallet, or personal data

See [Configuration Guide](docs/CONFIGURATION.md) for details on what each setting does.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](docs/SETUP.md) | Step-by-step installation for Mac, Windows, Linux |
| [Configuration](docs/CONFIGURATION.md) | Every setting explained |
| [How It Works](docs/HOW-IT-WORKS.md) | Scoring engine, signals, and analysis pipeline |
| [API Reference](docs/API.md) | Central API endpoints (for contributors) |
| [Contributing](docs/CONTRIBUTING.md) | How to contribute to the project |

---

## Project Structure

```
j33t-intel/
├── packages/
│   ├── shared/        # Types, scoring engine, validation, utilities
│   ├── cli/           # Command-line tool (backtest, rugcheck, scan)
│   └── worker/        # Cloudflare Worker API (community database)
├── docs/              # Documentation
├── .env.example       # API key template (safe to share)
├── .env               # Your actual API keys (never uploaded)
└── pnpm-workspace.yaml
```

---

## $J33T Token Tiers

Advanced features are unlocked by holding $J33T tokens. Balance is verified via Solana wallet connect — no staking required.

| Tier | $J33T Required | Analyses/Day | Features |
|------|---------------|-------------|----------|
| 🐕 Street Stray | 0 | 1 | Basic JSON output |
| 👃 First Sniff | 10,000 | 2 | + Rug Radar |
| 🐶 Loud Woofer | 50,000 | 3 | + J33T Take |
| 👆 Nose Certified | 100,000 | 5 | + Rug or Not + Daily Sniff |
| 🏃 Pack Runner | 500,000 | 8 | + Early Access patterns |
| 🐾 Paws of Steel | 1,000,000 | 13 | + Paws Staking |
| 🏆 Top Dog | 5,000,000 | 21 | + Full AI agent + Priority feed |

---

## Tech Stack

- **TypeScript** — Type-safe code across all packages
- **pnpm** — Fast monorepo package management
- **Helius API** — Solana transaction history
- **DexScreener API** — Market data and token info
- **Cloudflare Workers + D1** — Central API and community database
- **Hono** — Lightweight web framework for the Worker
- **Vitest** — Testing framework

---

## Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Backtester Tool | ✅ Live |
| 2 | Data Collection | 🔧 In progress |
| 3 | Pattern Engine | 📋 Planned |
| 4 | Live AI Agent | 📋 Planned |

---

## Disclaimer

J33T Intel is a research and analysis tool. Nothing in this repository constitutes financial advice. Meme token trading carries extreme risk. Always do your own research. NFA. DYOR. 🐾

---

## License

MIT — see [LICENSE](LICENSE)
