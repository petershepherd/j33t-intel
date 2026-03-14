# API Reference

The J33T Intel Central API handles community data submissions, pattern library access, tier verification, and leaderboards.

**Base URL:** `https://api.j33t.com`

> **Note:** The central API is optional. The CLI tool works fully offline without it. The API is only needed if you want to contribute data to the community database or access the shared pattern library.

---

## Response Format

All endpoints return JSON in this format:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": 1711234567890
}
```

Errors include an error object:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  },
  "timestamp": 1711234567890
}
```

---

## Endpoints

### Health Check

**`GET /`**

Returns API status and aggregate statistics. No authentication required.

---

### Submissions

**`POST /api/submissions`** — Submit an analysis result to the community database.

Rate limit: 50 submissions per day per contributor.

The request body must include a `submission` object with: `tokenCA`, `analyzedAt`, `patternType`, `signals`, `scores`, `clientVersion`, and optionally `filterSettings`, `entryMcapUsd`, `athMcapUsd`.

**`GET /api/submissions/:id`** — Get a specific submission by ID.

**`GET /api/submissions/token/:ca`** — Get all submissions for a token. Supports `?limit=20&offset=0`.

---

### Patterns

**`GET /api/patterns`** — Get the community pattern library.

Query parameters:

| Param | Type | Default | Options |
|-------|------|---------|---------|
| `type` | string | all | `positive`, `negative`, `unknown` |
| `sort` | string | `potential` | `potential`, `risk`, `submissions`, `recent` |
| `limit` | number | 20 | max 100 |
| `offset` | number | 0 | — |

**`GET /api/patterns/top/rugs`** — Top 10 rugpull patterns by risk score.

**`GET /api/patterns/top/gems`** — Top 10 high-potential patterns by potential score.

**`GET /api/patterns/:ca`** — Pattern summary for a specific token.

---

### Tier Verification

**`POST /api/tier/verify`** — Verify a wallet's $J33T token balance and return their tier.

Request body: `{ "walletAddress": "..." }`

Returns: tier ID, name, balance, analyses per day, analyses remaining today, and unlocked features.

**`GET /api/tier/info`** — Get all tier definitions. No authentication required.

---

### Leaderboard

**`GET /api/leaderboard`** — Community contribution leaderboard. Supports `?limit=25`.

Returns ranked contributors with submission count and accuracy score.

**`GET /api/leaderboard/stats`** — Aggregate database statistics (total submissions, tokens analyzed, contributors).

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_BODY` | 400 | Missing or malformed request body |
| `INVALID_CA` | 400 | Invalid Solana token address |
| `SUBMISSION_REJECTED` | 400 | Failed validation or duplicate submission |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Daily submission limit reached |
| `TOO_MANY_REQUESTS` | 429 | Request rate limit exceeded (60/min) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Requests per minute (per IP) | 60 |
| Submissions per day (per contributor) | 50 |

Contributors are identified by an anonymized hash — no personal data is stored.

---

## Self-Hosting the API

If you want to run your own central API:

```bash
cd packages/worker

# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create the D1 database
wrangler d1 create j33t-intel-db

# Update wrangler.toml with the database_id from the output above

# Run database migrations
wrangler d1 migrations apply j33t-intel-db

# Deploy the Worker
wrangler deploy
```

See [Configuration](CONFIGURATION.md) for environment variable details.

---

### Community Voting

**`GET /api/votes/disputed`** — Get disputed submissions waiting for community review. Supports `?limit=10`.

Returns submissions where the user's classification conflicts with the scoring engine, along with current vote counts.

**`POST /api/votes/cast`** — Vote on a disputed submission.

Request body:
```json
{
  "submissionId": "sub_xxx",
  "vote": "agree",
  "apiKey": "your_intel_api_key"
}
```

Vote must be `"agree"` (user is correct) or `"disagree"` (scoring engine is correct). You cannot vote on your own submissions. Minimum trust score of 25 required to vote.

A dispute is resolved after 5+ votes with a clear majority (>60%).

---

### Submission Response (Updated)

When submitting an analysis, the response now includes trust information:
```json
{
  "success": true,
  "data": {
    "id": "sub_xxx",
    "accepted": true,
    "submissionWeight": 1.0,
    "trustScore": 52,
    "disputed": false,
    "scoringPattern": "positive",
    "disputeReason": null,
    "contributor": { ... }
  }
}
```

If `disputed` is `true`, the submission enters community review.
