# Contributing to J33T Intel

Thanks for your interest in contributing! J33T Intel is a community-driven project, and every contribution makes the platform better for everyone.

---

## Two Ways to Contribute

### 1. Contribute Analysis Data (Easiest — No Coding Required)

Run the backtester or rugcheck on tokens, and your results automatically improve the community database.

**Setup:**

1. Connect your wallet at [j33t.com](https://j33t.com) → Intel tab
2. Click **Generate Key** and copy your Intel API key
3. Add to your `.env` file:

cat > docs/CONTRIBUTING.md << 'ENDOFFILE'
# Contributing to J33T Intel

Thanks for your interest in contributing! J33T Intel is a community-driven project, and every contribution makes the platform better for everyone.

---

## Two Ways to Contribute

### 1. Contribute Analysis Data (Easiest — No Coding Required)

Run the backtester or rugcheck on tokens, and your results automatically improve the community database.

**Setup:**

1. Connect your wallet at [j33t.com](https://j33t.com) → Intel tab
2. Click **Generate Key** and copy your Intel API key
3. Add to your `.env` file:
J33T_INTEL_KEY=your_key_here
CONTRIBUTE_TO_COMMUNITY=true
4. Run analyses — every backtest and rugcheck automatically uploads results

**Rewards for contributing:**

| Level | Requirement | Rewards |
|-------|------------|---------|
| 🥉 Contributor | 1+ submission | +1 daily analysis, pattern library access |
| 🥈 Active Contributor | 7-day streak | +2 daily analyses, airdrop eligible (1x) |
| 🥇 Power Contributor | 30-day streak | +3 daily analyses, airdrop multiplier 2x |
| 💎 Diamond Contributor | 90-day streak | +5 daily analyses, airdrop multiplier 5x |

**Future airdrops and rewards will ONLY go to active contributors.** The longer your daily streak, the higher your multiplier.

Track your progress at [j33t.com](https://j33t.com) → Intel tab.

### 2. Contribute Code

Help improve the tool itself — see the development guide below.

---

## Development Setup

### Fork and Clone
```bash
git clone https://github.com/YOUR_USERNAME/j33t-intel.git
cd j33t-intel
pnpm install
pnpm build
```

### Project Structure
packages/
├── shared/     # Types, scoring engine, validation (used by cli and worker)
├── cli/        # Command-line analysis tool
└── worker/     # Cloudflare Worker API + D1 database

Changes to `shared/` affect both `cli/` and `worker/`. Always rebuild after changes:
```bash
pnpm build
```

### Running Tests
```bash
pnpm test
```

### Deploying the Worker
```bash
cd packages/worker
wrangler login
wrangler deploy
```

---

## Live Infrastructure

| Component | URL |
|-----------|-----|
| Central API | https://j33t-intel-api.juhasz-peter1986.workers.dev |
| Dashboard | [j33t.com](https://j33t.com) → Intel tab |
| Database | Cloudflare D1 (EEUR region) |
| Cron | Daily at 00:00 UTC (balance refresh + streak reset) |

---

## Pull Request Process

1. Create a branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes
3. Run `pnpm build` — make sure there are no errors
4. Run `pnpm test` — make sure all tests pass
5. Commit with a clear message: `git commit -m "feat: add liquidity lock detection"`
6. Push and open a PR

### Commit Message Format

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `refactor:` — Code restructuring
- `test:` — Adding or updating tests
- `chore:` — Build process, tooling

---

## Areas Where Help Is Most Needed

### High Priority
- **Liquidity lock detection** — On-chain verification of lock contracts (Raydium, Meteora)
- **Freeze/mint authority checking** — Reading token metadata directly from Solana RPC
- **Historical price data** — Getting MCap at specific timestamps for more accurate backtesting

### Medium Priority
- **More test tokens** — Running backtests on known good and bad tokens to calibrate scoring weights
- **Windows testing** — Ensuring the CLI works correctly on Windows
- **Better bundle detection** — Common funding source analysis (requires additional Helius API calls)

### Nice to Have
- **Documentation translations** — Making docs available in other languages
- **CI/CD pipeline** — GitHub Actions for automated testing and deployment
- **CLI interactive mode** — Guided prompts for first-time users

---

## Code Style

- TypeScript strict mode — no `any` types unless absolutely necessary
- Functions should have JSDoc comments explaining what they do
- Keep functions focused — one function, one job
- Use meaningful variable names
- Handle errors gracefully — never let the CLI crash without a helpful message

---

## What Gets Sent to the Community Database

When a user opts in to contribute, **only these anonymized fields are sent**:

- Token contract address
- Pattern type (positive/negative/unknown)
- Detection signals (14 numerical values)
- Scores (potential, risk, confidence)
- Filter settings
- Client version

**Never sent:** API keys, wallet addresses, IP addresses, personal data.

---

## Code of Conduct

- Be respectful and constructive
- No financial advice or token shilling in issues/PRs
- Focus on making the tool better for everyone
- Credit others' contributions

---

## Questions?

Open a GitHub issue or reach out on the J33T community channels.
