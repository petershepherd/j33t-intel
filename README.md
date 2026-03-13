# J33T Intel 🐾

**Open-source on-chain intelligence platform for Solana meme tokens.**

J33T Intel analyzes Solana token transactions to detect promising early launches and filter out rugpulls — before they happen. Contribute your analyses to earn rewards and future airdrop eligibility.

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

### 1. Install

```bash
git clone https://github.com/petershepherd/j33t-intel.git
cd j33t-intel
pnpm install
pnpm build
```

### 2. Get your API keys

- **Helius API key** (required) — Free at [helius.dev](https://helius.dev)
- **J33T Intel API key** (optional, for contributing) — Connect your wallet at [j33t.com](https://j33t.com) → Intel tab → Generate Key

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```env
HELIUS_API_KEY=your_helius_key_here
J33T_INTEL_KEY=your_intel_key_here    # optional — for community contribution
CONTRIBUTE_TO_COMMUNITY=true           # optional — earn rewards by contributing
```

### 4. Run

```bash
# Backtest a successful token
node packages/cli/dist/index.js backtest <TOKEN_ADDRESS> --verbose

# Analyze a known rugpull
node packages/cli/dist/index.js rugcheck <TOKEN_ADDRESS> --verbose

# Contribute results to the community database
node packages/cli/dist/index.js backtest <TOKEN_ADDRESS> --contribute
```

---

## Three Modes

### 1. Backtest — Learn from winners
Input a successful token. J33T Intel reconstructs its early trading history and finds the optimal scanner settings that would have detected it under $100K market cap.

### 2. Rugcheck — Learn from scams
Input a known rugpull. The system extracts the behavioral signatures from the pre-rug phase, creating patterns that help detect future scams.

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

Each signal is scored 0–100, weighted, and combined into the final Potential and Risk scores. See [How It Works](docs/HOW-IT-WORKS.md) for the full scoring breakdown.

---

## Community & Rewards

J33T Intel gets smarter every time someone contributes. When you opt in, your anonymized analysis results improve detection for everyone.

### Contributor Levels

| Level | Requirement | Rewards |
|-------|------------|---------|
| 🥉 Contributor | 1+ submission | +1 daily analysis, pattern library access |
| 🥈 Active Contributor | 7-day streak | +2 daily analyses, airdrop eligible (1x) |
| 🥇 Power Contributor | 30-day streak | +3 daily analyses, airdrop multiplier 2x |
| 💎 Diamond Contributor | 90-day streak | +5 daily analyses, airdrop multiplier 5x |

**Future airdrops and rewards will ONLY go to active contributors.** The longer your daily streak, the higher your reward multiplier.

### How to contribute

1. Connect your wallet at [j33t.com](https://j33t.com) → Intel tab
2. Generate your Intel API key
3. Add it to your `.env`: `J33T_INTEL_KEY=your_key`
4. Set `CONTRIBUTE_TO_COMMUNITY=true`
5. Run analyses — every `--contribute` submission builds your streak

Track your streak and leaderboard position at [j33t.com](https://j33t.com) → Intel tab.

---

## $J33T Token Tiers

Advanced features are unlocked by holding $J33T tokens. Balance is verified via Solana wallet connect — no staking required. Balance is checked daily by our automated system.

| Tier | $J33T Required | Analyses/Day | Features |
|------|---------------|-------------|----------|
| 🐕 Street Stray | 0 | 1 | Basic JSON output |
| 👃 First Sniff | 10,000 | 2 | + Rug Radar |
| 🐶 Loud Woofer | 50,000 | 3 | + J33T Take |
| 👆 Nose Certified | 100,000 | 5 | + Rug or Not + Daily Sniff |
| 🏃 Pack Runner | 500,000 | 8 | + Early Access patterns |
| 🐾 Paws of Steel | 1,000,000 | 13 | + Paws Staking |
| 🏆 Top Dog | 5,000,000 | 21 | + Full AI agent + Priority feed |

Contributor bonus analyses stack on top of tier limits.

---

## Security & Privacy

**Your API keys are never uploaded, shared, or exposed.**

- The `.env` file is in `.gitignore` — Git will never upload it
- Only `.env.example` (with empty placeholders) is on GitHub
- The CLI runs entirely on your machine
- Your Intel API key is hashed (SHA-256) before storage — even we can't see it
- Community contribution is **opt-in only** and sends anonymized results — never your keys, wallet, or personal data
- Wallet balances are checked daily via Solana RPC — no wallet access required

See [Configuration Guide](docs/CONFIGURATION.md) for details.

---

## Architecture

```
j33t-intel/
├── packages/
│   ├── shared/        # Types, scoring engine, validation, utilities
│   ├── cli/           # Command-line tool (backtest, rugcheck, scan)
│   └── worker/        # Cloudflare Worker API (community database)
├── docs/              # Documentation
├── .env.example       # API key template (safe to share)
└── .env               # Your actual API keys (never uploaded)
```

### Live Infrastructure

| Component | URL | Purpose |
|-----------|-----|---------|
| Central API | `j33t-intel-api.juhasz-peter1986.workers.dev` | Community database, leaderboard, tier verification |
| Dashboard | [j33t.com](https://j33t.com) → Intel tab | API key management, streak tracking, leaderboard |
| Database | Cloudflare D1 (EEUR region) | Submissions, contributor profiles, API keys |
| Cron | Daily at 00:00 UTC | Balance refresh, tier updates, streak resets |

### Tech Stack

- **TypeScript** — Type-safe code across all packages
- **pnpm** — Fast monorepo package management
- **Helius API** — Solana transaction history
- **DexScreener API** — Market data and token info
- **Cloudflare Workers + D1** — Central API and community database
- **Hono** — Lightweight web framework for the Worker
- **Vitest** — Testing framework

---

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](docs/SETUP.md) | Step-by-step installation for Mac, Windows, Linux |
| [Configuration](docs/CONFIGURATION.md) | Every setting explained |
| [How It Works](docs/HOW-IT-WORKS.md) | Scoring engine, signals, and analysis pipeline |
| [API Reference](docs/API.md) | Central API endpoints |
| [Contributing](docs/CONTRIBUTING.md) | How to contribute code |

---

## Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Backtester Tool | ✅ Live |
| 2 | Community Database & Rewards | ✅ Live |
| 3 | Pattern Engine (AI) | 📋 Planned |
| 4 | Live AI Agent | 📋 Planned |

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

Areas where help is most needed:
- Liquidity lock detection (on-chain verification)
- Freeze/mint authority checking via Solana RPC
- More test tokens for scoring calibration
- Windows testing

---

## Disclaimer

J33T Intel is a research and analysis tool. Nothing in this repository constitutes financial advice. Meme token trading carries extreme risk. Always do your own research. NFA. DYOR. 🐾

---

## License

MIT — see [LICENSE](LICENSE)
