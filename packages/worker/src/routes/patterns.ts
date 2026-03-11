/**
 * Patterns Route
 *
 * GET /api/patterns              — Get community pattern library
 * GET /api/patterns/:ca          — Get pattern summary for a specific token
 * GET /api/patterns/top/rugs     — Top 10 rugpull patterns
 * GET /api/patterns/top/gems     — Top 10 high-potential patterns
 */

import { Hono } from "hono";
import type { Env } from "../index.js";
import type { ApiResponse, PatternType } from "@j33t-intel/shared";
import { isValidSolanaCA } from "@j33t-intel/shared";
import { getPatterns, getTopRugpullPatterns } from "../db/helpers.js";
import type { PatternSummaryRow } from "../db/helpers.js";

export const patternsRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/patterns
 * Get the community pattern library with filtering and pagination.
 *
 * Query params:
 *   type     — "positive" | "negative" | "unknown"
 *   sort     — "potential" | "risk" | "submissions" | "recent"
 *   limit    — max results (default 20, max 100)
 *   offset   — pagination offset
 */
patternsRouter.get("/", async (c) => {
  const patternType = c.req.query("type") as PatternType | undefined;
  const sortBy = (c.req.query("sort") ?? "potential") as "potential" | "risk" | "submissions" | "recent";
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  const offset = Number(c.req.query("offset") ?? 0);

  // Validate pattern type if provided
  if (patternType && !["positive", "negative", "unknown"].includes(patternType)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: { code: "INVALID_TYPE", message: "type must be 'positive', 'negative', or 'unknown'" },
        timestamp: Date.now(),
      },
      400,
    );
  }

  const result = await getPatterns(c.env.DB, {
    patternType,
    sortBy,
    limit,
    offset,
  });

  return c.json<ApiResponse>({
    success: true,
    data: {
      patterns: result.patterns.map(formatPatternRow),
      total: result.total,
      limit,
      offset,
    },
    timestamp: Date.now(),
  });
});

/**
 * GET /api/patterns/top/rugs
 * Top 10 rugpull patterns by risk score and submission count.
 * Public leaderboard — no auth required.
 */
patternsRouter.get("/top/rugs", async (c) => {
  const patterns = await getTopRugpullPatterns(c.env.DB, 10);

  return c.json<ApiResponse>({
    success: true,
    data: {
      patterns: patterns.map((p, i) => ({
        rank: i + 1,
        ...formatPatternRow(p),
      })),
    },
    timestamp: Date.now(),
  });
});

/**
 * GET /api/patterns/top/gems
 * Top 10 high-potential patterns by potential score.
 */
patternsRouter.get("/top/gems", async (c) => {
  const result = await getPatterns(c.env.DB, {
    patternType: "positive",
    sortBy: "potential",
    limit: 10,
  });

  return c.json<ApiResponse>({
    success: true,
    data: {
      patterns: result.patterns.map((p, i) => ({
        rank: i + 1,
        ...formatPatternRow(p),
      })),
    },
    timestamp: Date.now(),
  });
});

/**
 * GET /api/patterns/:ca
 * Get the pattern summary for a specific token.
 */
patternsRouter.get("/:ca", async (c) => {
  const ca = c.req.param("ca");

  if (!isValidSolanaCA(ca)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: { code: "INVALID_CA", message: "Invalid Solana token address" },
        timestamp: Date.now(),
      },
      400,
    );
  }

  const row = await c.env.DB
    .prepare("SELECT * FROM pattern_summaries WHERE token_ca = ?")
    .bind(ca)
    .first<PatternSummaryRow>();

  if (!row) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "No pattern data found for this token" },
        timestamp: Date.now(),
      },
      404,
    );
  }

  return c.json<ApiResponse>({
    success: true,
    data: formatPatternRow(row),
    timestamp: Date.now(),
  });
});

/**
 * Format a DB row into a clean API response object.
 */
function formatPatternRow(row: PatternSummaryRow) {
  return {
    tokenCA: row.token_ca,
    patternType: row.pattern_type,
    potentialScore: Math.round(row.avg_potential_score),
    rugpullRiskScore: Math.round(row.avg_rugpull_risk_score),
    submissionCount: row.submission_count,
    lastUpdated: row.last_updated,
    averageFilterSettings: row.avg_filter_settings
      ? JSON.parse(row.avg_filter_settings)
      : null,
  };
}
