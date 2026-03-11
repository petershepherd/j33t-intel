# J33T Intel API Documentation

**Base URL:** `https://api.j33t.com`

All responses follow the standard format:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": 1711234567890
}
```

Error responses include an `error` object:

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

## Health Check

### `GET /`

Returns API status and aggregate statistics.

**Response:**
```json
{
  "name": "J33T Intel API",
  "version": "0.1.0",
  "status": "operational",
  "stats": {
    "totalSubmissions": 1234,
    "totalTokens": 567,
    "totalContributors": 89
  },
  "timestamp": 1711234567890
}
```

---

## Submissions

### `POST /api/submissions`

Submit an analysis result to the community database.

**Rate limit:** 50 submissions per day per contributor.

**Request body:**
```json
{
  "submission": {
    "tokenCA": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "analyzedAt": 1711234567890,
    "patternType": "positive",
    "signals": {
      "liquidityGrowthRate": 150.5,
      "buySellRatio": 3.2,
      "bundlePercentage": 5.0,
      "bundleCount": 1,
      "top10HolderPercentage": 25.0,
      "devSoldPercentage": 0,
      "liquidityLocked": true,
      "liquidityLockDurationHours": 72,
      "volumeMcapRatio": 0.8,
      "priceMomentumScore": 0.6,
      "hasFreezeAuthority": false,
      "hasMintAuthority": false,
      "transactionTimingSuspicion": 0.1,
      "uniqueWalletsFirst10Min": 75
    },
    "scores": {
      "potentialScore": 78,
      "rugpullRiskScore": 15,
      "confidence": 85,
      "signalBreakdown": []
    },
    "filterSettings": { ... },
    "entryMcapUsd": 45000,
    "athMcapUsd": 2500000,
    "clientVersion": "0.1.0"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "sub_m3x7k2_a1b2c3d4",
    "accepted": true
  }
}
```

### `GET /api/submissions/:id`

Get a specific submission by ID.

### `GET /api/submissions/token/:ca`

Get all submissions for a token. Supports `?limit=20&offset=0`.

---

## Patterns

### `GET /api/patterns`

Get the community pattern library.

**Query params:**
| Param  | Type   | Default      | Description |
|--------|--------|-------------|-------------|
| type   | string | (all)       | "positive", "negative", or "unknown" |
| sort   | string | "potential" | "potential", "risk", "submissions", "recent" |
| limit  | number | 20          | Max results (max 100) |
| offset | number | 0           | Pagination offset |

### `GET /api/patterns/top/rugs`

Top 10 rugpull patterns by risk score. Public leaderboard.

### `GET /api/patterns/top/gems`

Top 10 high-potential patterns by potential score.

### `GET /api/patterns/:ca`

Get the aggregated pattern summary for a specific token.

---

## Tier Verification

### `POST /api/tier/verify`

Verify a wallet's $J33T token balance and return their tier.

**Request body:**
```json
{
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "7xKX...sAsU",
    "balance": 150000,
    "tierId": "nose_certified",
    "tierName": "Nose Certified",
    "tierEmoji": "👆",
    "analysesPerDay": 5,
    "analysesUsedToday": 2,
    "analysesRemaining": 3,
    "features": ["basic_json", "rug_radar", "j33t_take", "rug_or_not", "daily_sniff"]
  }
}
```

### `GET /api/tier/info`

Get all tier definitions (public, no auth).

---

## Leaderboard

### `GET /api/leaderboard`

Community contribution leaderboard. Supports `?limit=25`.

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "rank": 1,
        "contributorId": "a1b2c3d4e5f6g7h8",
        "submissionCount": 342,
        "accuracyScore": 87,
        "memberSince": 1711000000000,
        "lastActive": 1711234567890
      }
    ],
    "totalContributors": 89
  }
}
```

### `GET /api/leaderboard/stats`

Aggregate database statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSubmissions": 1234,
    "totalTokensAnalyzed": 567,
    "totalContributors": 89,
    "positivePatterns": 234,
    "negativePatterns": 333,
    "submissionsToday": 45
  }
}
```

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| INVALID_BODY | 400 | Missing or malformed request body |
| INVALID_CA | 400 | Invalid Solana token address |
| INVALID_TYPE | 400 | Invalid pattern type parameter |
| MISSING_WALLET | 400 | walletAddress not provided |
| INVALID_WALLET | 400 | Invalid Solana wallet address |
| SUBMISSION_REJECTED | 400 | Submission failed validation or duplicate |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMITED | 429 | Daily submission limit reached |
| TOO_MANY_REQUESTS | 429 | Request rate limit exceeded |
| VERIFICATION_FAILED | 500 | Failed to verify token balance |
| INTERNAL_ERROR | 500 | Unexpected server error |

---

## Rate Limits

- **Requests:** 60 per minute per IP
- **Submissions:** 50 per day per contributor
- **Contributor identity:** Anonymized hash of IP + User-Agent

## Deployment

```bash
cd packages/worker

# Create D1 database
wrangler d1 create j33t-intel-db

# Update wrangler.toml with the database_id

# Run migrations
wrangler d1 migrations apply j33t-intel-db

# Deploy
wrangler deploy
```
