# Contributing to J33T Intel

Thanks for your interest in contributing! J33T Intel is a community-driven project, and every contribution makes the platform better for everyone.

---

## Ways to Contribute

### 1. Submit Analysis Data (Easiest)
Run the backtester or rugcheck on tokens you know about, then opt in to share the results with the community database. This helps calibrate the scoring engine.

```bash
node packages/cli/dist/index.js backtest <TOKEN_CA> --contribute
```

### 2. Report Bugs
Found something wrong? Open an issue on GitHub with:
- What you did (the command you ran)
- What you expected to happen
- What actually happened
- The full error message (if any)

### 3. Suggest Improvements
Have an idea for a new signal, a better scoring formula, or a missing feature? Open a GitHub issue with the `enhancement` label.

### 4. Contribute Code
See the development guide below.

---

## Development Setup

### Fork and Clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/j33t-intel.git
cd j33t-intel
pnpm install
pnpm build
```

### Project Structure

```
packages/
├── shared/     # Types, scoring engine, validation (used by both cli and worker)
├── cli/        # Command-line tool
└── worker/     # Cloudflare Worker API
```

Changes to `shared/` affect both `cli/` and `worker/`. Always rebuild after changes:

```bash
pnpm build
```

### Running Tests

```bash
pnpm test
```

### Code Style

- TypeScript strict mode
- No `any` types — use proper typing
- Functions should have JSDoc comments explaining what they do
- Keep functions focused — one function, one job

---

## Pull Request Process

1. Create a branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes
3. Run `pnpm build` — make sure there are no errors
4. Run `pnpm test` — make sure all tests pass
5. Commit with a clear message: `git commit -m "feat: add liquidity lock detection"`
6. Push and open a PR

### Commit Message Format

We use conventional commits:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `refactor:` — Code changes that don't add features or fix bugs
- `test:` — Adding or updating tests
- `chore:` — Build process, tooling, etc.

---

## Areas Where Help Is Most Needed

- **Liquidity lock detection** — On-chain verification of lock contracts
- **Freeze/mint authority checking** — Reading token metadata from Solana
- **More test tokens** — Running backtests on known good and bad tokens to calibrate scoring
- **Windows testing** — Ensuring everything works on Windows
- **Documentation translations** — Making docs available in other languages

---

## Code of Conduct

- Be respectful and constructive
- No financial advice or token shilling in issues/PRs
- Focus on making the tool better for everyone
- Credit others' contributions

---

## Questions?

Open a GitHub issue or reach out on the J33T community channels.
