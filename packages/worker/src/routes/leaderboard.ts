/**
 * Leaderboard Route
 *
 * GET /api/leaderboard            — Community contribution leaderboard
 * GET /api/leaderboard/stats      — Aggregate database statistics
 */

import { Hono } from "hono";
import type { Env } from "../index.js";
import type { ApiResponse } from "@j33t-intel/shared";
import { getLeaderboard, getStats } from "../db/helpers.js";

export const leaderboardRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/leaderboard
 * Get the community contribution leaderboard.
 * Ranked by submission count, then by average confidence.
 *
 * Query params:
 *   limit — max results (default 25, max 100)
 */
leaderboardRouter.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 25), 100);

  const { entries, totalContributors } = await getLeaderboard(c.env.DB, limit);

  return c.json<ApiResponse>({
    success: true,
    data: {
      entries: entries.map((entry, index) => ({
        rank: index + 1,
        contributorId: entry.contributor_hash,
        submissionCount: entry.submission_count,
        accuracyScore: Math.round(entry.avg_confidence),
        memberSince: entry.first_submission,
        lastActive: entry.last_submission,
      })),
      totalContributors,
    },
    timestamp: Date.now(),
  });
});

/**
 * GET /api/leaderboard/stats
 * Aggregate statistics about the community database.
 * Public endpoint — useful for dashboards and the j33t.com frontend.
 */
leaderboardRouter.get("/stats", async (c) => {
  const stats = await getStats(c.env.DB);

  return c.json<ApiResponse>({
    success: true,
    data: {
      totalSubmissions: stats.totalSubmissions,
      totalTokensAnalyzed: stats.totalTokens,
      totalContributors: stats.totalContributors,
      positivePatterns: stats.positivePatterns,
      negativePatterns: stats.negativePatterns,
      submissionsToday: stats.submissionsToday,
    },
    timestamp: Date.now(),
  });
});
