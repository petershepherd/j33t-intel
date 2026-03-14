# How It Works

This document explains how J33T Intel analyzes tokens, what each signal means, and how the scoring engine produces its results.

---

## The Analysis Pipeline

When you run `backtest` or `rugcheck`, J33T Intel executes these steps in order:

```
Token Address
    ↓
1. Fetch market data (DexScreener)
    ↓
2. Fetch transaction history (Helius API — up to 500 transactions)
    ↓
3. Parse and classify each transaction (buy / sell / add liquidity / remove liquidity / transfer)
    ↓
4. Detect wallet bundles (coordinated buying)
    ↓
5. Analyze deployer wallet behavior
    ↓
6. Check holder distribution (top 10 holders)
    ↓
7. Compute all 14 detection signals
    ↓
8. Score each signal (0–100) and calculate weighted totals
    ↓
9. Find optimal entry point (backtester mode)
    ↓
10. Generate filter settings
    ↓
JSON output file
```

The entire process typically takes 8–15 seconds, depending on API response times.

---

## Detection Signals Explained

### Buy/Sell Ratio
Counts how many buy transactions vs sell transactions occurred in the first 60 minutes. A ratio above 1.5x suggests genuine interest. Below 1.0x means more selling than buying — a warning sign.

**Scoring**: 0.3x or below = 5/100 (very bad) → 3.0x = 95/100 (very good) → above 8.0x = 55/100 (suspicious wash trading)

### Bundle Detection
A "bundle" is a group of wallets that buy a token in the same block or within seconds of each other. This often indicates coordinated manipulation — one person using multiple wallets to fake organic demand.

J33T Intel detects bundles two ways:
- **Same-slot clustering**: Wallets buying in the exact same Solana slot
- **Time-proximity clustering**: Different wallets buying within a tight 30-second window

**Scoring**: 0–2% of supply in bundles = 95/100 → above 40% = 5/100

### Top 10 Holder Percentage
Checks what percentage of the token supply is held by the 10 largest wallets. On Solana, this number is typically higher than on other chains because LP pools and exchange wallets are included.

**Scoring**: Under 30% = 95/100 (excellent) → 70–85% = 40/100 (typical for Solana) → above 85% = 15/100 (extreme risk)

### Dev Wallet Behavior
Tracks the deployer (token creator) wallet. Key questions: Did they sell? When? How much?

A developer selling 50% of supply within 10 minutes of launch is a classic rugpull signature. A developer who hasn't sold at all could be a positive sign — or could mean the rug hasn't happened yet.

**Scoring**: 0% sold = 95/100 → 5% sold = 80/100 → 40%+ sold = 5/100

### Liquidity Lock
Checks whether the token's liquidity is locked (making it impossible for the dev to withdraw). Locked liquidity significantly reduces rug risk.

**Scoring**: Locked = 85/100 → Not locked = 35/100

*Note: The current version cannot yet verify on-chain lock status. This will be added in a future update.*

### Freeze Authority
Some Solana tokens have "freeze authority" enabled, which means the developer can freeze any holder's tokens — preventing them from selling. This is a major red flag.

**Scoring**: No freeze authority = 90/100 → Freeze authority exists = 5/100

### Mint Authority
If mint authority is enabled, the developer can create unlimited new tokens, diluting all existing holders. Another significant red flag.

**Scoring**: No mint authority = 90/100 → Mint authority exists = 10/100

### Volume/MCap Ratio
Compares 24-hour trading volume to market cap. Very low volume suggests the token is dying. Very high volume relative to market cap could indicate wash trading.

**Scoring**: Under 0.001 = 10/100 → 0.1–1.0 = 80/100 (healthy) → above 3.0 = 50/100 (suspicious)

### Price Momentum
Analyzes the pattern of buy amounts over time. Organic tokens show gradual, sustained growth. Artificial pumps show sudden spikes followed by crashes.

The analysis splits the trading period into quarters and checks whether average transaction sizes are growing steadily (organic) or spiking erratically (artificial).

**Scoring**: -0.5 or below = 10/100 (dump) → 0.3–0.7 = 80/100 (healthy) → above 0.7 = 90/100 (strong growth)

### Transaction Timing
Analyzes the first 5 minutes of trading for bot-like patterns. Three things are checked:

1. **Early burst**: More than 10 buys in the first 10 seconds suggests pre-programmed bots
2. **Same-slot ratio**: High ratio of multi-wallet slots suggests coordinated buying
3. **Interval regularity**: Very regular intervals between buys (low variance) suggests bots

**Scoring**: All three combined into a weighted score. 0% suspicion = 90/100 → 80%+ = 10/100

### Unique Wallets (First 10 Minutes)
Counts how many different wallets bought the token in the first 10 minutes after launch. More unique wallets = more organic interest. Very few wallets could mean only the dev and their bots are buying.

**Scoring**: Under 3 = 15/100 → 30–80 = 80/100 → above 200 = 65/100 (possible Sybil attack)

### Liquidity Growth Rate
Measures how fast liquidity grows per minute since launch. Healthy tokens show moderate, sustained growth. Artificial injection shows extremely fast growth that often reverses.

### Bundle Count
The raw number of detected bundle groups. Used alongside Bundle Percentage for a complete picture.

### Lock Duration
If liquidity is locked, how long is the lock period? Longer locks are generally safer.

---

## How Scoring Works

### Individual Signal Scoring
Each of the 14 signals is normalized to a 0–100 scale using the thresholds described above. For example, a buy/sell ratio of 2.5x gets a score of about 85/100.

### Weighted Combination
Each signal has two weights — one for Potential and one for Risk:

**Potential Score weights** (what matters most for upside):
- Buy/Sell Ratio: 14%
- Dev Sold: 12%
- Bundle %: 10%
- Volume/MCap: 10%
- Price Momentum: 10%

**Risk Score weights** (what matters most for rug detection):
- Bundle %: 18%
- Dev Sold: 16%
- Freeze Authority: 10%
- Mint Authority: 8%
- Liquidity Lock: 8%

The Risk Score is calculated by inverting the signal scores — a high Potential signal becomes a low Risk contribution.

### Pattern Classification
Based on the final scores:
- **POSITIVE**: Potential > 60 and Risk < 40
- **NEGATIVE**: Risk > 60
- **UNKNOWN**: Everything else

### Confidence
Confidence reflects how many signals had actual data (non-zero values). If some signals couldn't be computed (e.g., no transaction data), confidence drops.

---

## Backtester vs Rugcheck

Both modes run the same pipeline. The differences are:

| | Backtest | Rugcheck |
|---|---------|----------|
| **Purpose** | Find what makes a token successful | Find what makes a token a rug |
| **Pattern type** | Can be POSITIVE, NEGATIVE, or UNKNOWN | Always set to NEGATIVE |
| **Filter settings** | Tuned to *catch* tokens like this | Tuned to *reject* tokens like this |
| **Best used on** | Known successful meme tokens | Known rugpulls |

The filter settings from backtest mode tell you: "If your scanner used these settings, it would have caught this token." The settings from rugcheck mode tell you: "If your scanner used these settings, it would have filtered this token out."

---

## Data Sources

| Source | What it provides | Rate limits |
|--------|-----------------|-------------|
| **Helius API** | Transaction history, holder data, signatures | 40 req/sec (free tier) |
| **DexScreener API** | Market cap, price, liquidity, volume, pair info | 300 req/min (no key needed) |

J33T Intel includes built-in rate limiters to stay within these limits automatically.

---

## Limitations

Things the current version cannot do (yet):

- **On-chain liquidity lock verification** — Currently defaults to "not locked"
- **Freeze/mint authority check** — Currently defaults to "no" (future: on-chain verification)
- **Historical price data** — Entry point MCap is estimated, not exact
- **Real-time monitoring** — The live scan mode is not yet implemented
- **AI-powered analysis** — Rule-based only for now; AI integration is Phase 3

These limitations will be addressed in future updates as the project progresses through its roadmap.

---

## Trust Score System

Every contributor has a Trust Score (0–100) that determines how much weight their submissions carry in the community database. This system prevents manipulation and rewards accurate contributions.

### How It Works

When you submit an analysis, the scoring engine independently evaluates the token and compares its conclusion with yours:

- **You say POSITIVE, scoring agrees** → Trust +2, submission weight normal
- **You say POSITIVE, scoring says NEGATIVE** → Trust -5, submission marked as **disputed**
- **You say NEGATIVE, scoring says POSITIVE** → Trust -5, submission marked as **disputed**
- **Community votes agree with you** → Trust +3
- **Community votes disagree** → Trust -3

### Starting Score

Everyone starts at **50/100**. Your score changes with every submission.

### Submission Weight

Your trust score determines how much your submissions influence the community pattern library:

| Trust Score | Weight | Label |
|-------------|--------|-------|
| 80–100 | 1.5x | Trusted contributor |
| 50–79 | 1.0x | Normal |
| 25–49 | 0.5x | Reduced weight |
| 0–24 | 0.1x | Practically ignored |

### Disputed Submissions

When the scoring engine disagrees with your classification, the submission is marked as **disputed** and enters the community review queue. Other contributors can vote:

- **Agree** — "I think the user's classification is correct"
- **Disagree** — "I think the scoring engine is correct"

A dispute is resolved when:
- 5 or more votes have been cast
- One side has more than 60% of the votes

If the community agrees with you, your trust score gets a bonus. If they disagree, the submission's pattern type is overridden to match the scoring engine's assessment.

### Protection Against Manipulation

- If your trust score drops below **10** and you have 3+ disputed submissions in the last 24 hours, your submissions are **temporarily blocked** for 24 hours
- The penalty for disagreement (-5) is larger than the reward for agreement (+2), making it expensive to spam bad data
- Community voters must have a trust score of 25+ to vote, preventing sock puppet manipulation

### Why This Matters

The community database is only as good as the data in it. The trust system ensures that:

1. Accurate contributors have more influence on pattern detection
2. Manipulators are gradually silenced without being banned
3. Ambiguous cases get resolved by community consensus
4. Everyone is incentivized to be honest and accurate

### Viewing Your Trust Score

Your trust score is visible on the [j33t.com](https://j33t.com) Intel dashboard. The color indicates your status:

- 🟢 Green (80+): Trusted
- 🟡 Gold (50–79): Normal
- 🟠 Orange (25–49): Reduced
- 🔴 Red (0–24): At risk of being blocked

### Tips for Maintaining a High Trust Score

- Use **backtest** for tokens you believe are successful
- Use **rugcheck** for tokens you know were rugged
- Don't classify a token as negative just because you don't like it — use the scoring as a guide
- If you're unsure, the scoring engine's pattern classification (shown in the analysis output) is a good indicator

---

## Trust Score System

Every contributor has a Trust Score (0–100) that determines how much weight their submissions carry in the community database. This system prevents manipulation and rewards accurate contributions.

### How It Works

When you submit an analysis, the scoring engine independently evaluates the token and compares its conclusion with yours:

- **You say POSITIVE, scoring agrees** → Trust +2, submission weight normal
- **You say POSITIVE, scoring says NEGATIVE** → Trust -5, submission marked as **disputed**
- **You say NEGATIVE, scoring says POSITIVE** → Trust -5, submission marked as **disputed**
- **Community votes agree with you** → Trust +3
- **Community votes disagree** → Trust -3

### Starting Score

Everyone starts at **50/100**. Your score changes with every submission.

### Submission Weight

Your trust score determines how much your submissions influence the community pattern library:

| Trust Score | Weight | Label |
|-------------|--------|-------|
| 80–100 | 1.5x | Trusted contributor |
| 50–79 | 1.0x | Normal |
| 25–49 | 0.5x | Reduced weight |
| 0–24 | 0.1x | Practically ignored |

### Disputed Submissions

When the scoring engine disagrees with your classification, the submission is marked as **disputed** and enters the community review queue. Other contributors can vote:

- **Agree** — "I think the user's classification is correct"
- **Disagree** — "I think the scoring engine is correct"

A dispute is resolved when:
- 5 or more votes have been cast
- One side has more than 60% of the votes

If the community agrees with you, your trust score gets a bonus. If they disagree, the submission's pattern type is overridden to match the scoring engine's assessment.

### Protection Against Manipulation

- If your trust score drops below **10** and you have 3+ disputed submissions in the last 24 hours, your submissions are **temporarily blocked** for 24 hours
- The penalty for disagreement (-5) is larger than the reward for agreement (+2), making it expensive to spam bad data
- Community voters must have a trust score of 25+ to vote, preventing sock puppet manipulation

### Why This Matters

The community database is only as good as the data in it. The trust system ensures that:

1. Accurate contributors have more influence on pattern detection
2. Manipulators are gradually silenced without being banned
3. Ambiguous cases get resolved by community consensus
4. Everyone is incentivized to be honest and accurate

### Viewing Your Trust Score

Your trust score is visible on the [j33t.com](https://j33t.com) Intel dashboard. The color indicates your status:

- 🟢 Green (80+): Trusted
- 🟡 Gold (50–79): Normal
- 🟠 Orange (25–49): Reduced
- 🔴 Red (0–24): At risk of being blocked

### Tips for Maintaining a High Trust Score

- Use **backtest** for tokens you believe are successful
- Use **rugcheck** for tokens you know were rugged
- Don't classify a token as negative just because you don't like it — use the scoring as a guide
- If you're unsure, the scoring engine's pattern classification (shown in the analysis output) is a good indicator
