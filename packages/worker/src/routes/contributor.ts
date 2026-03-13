import { Hono } from "hono";
import type { Env } from "../index.js";
import type { ApiResponse } from "@j33t-intel/shared";
import { generateContributorHash } from "../middleware/auth.js";
import { getContributorProfile, getTopContributors, CONTRIBUTOR_LEVELS } from "../db/contributors.js";
import { hashApiKey } from "../db/api-keys.js";

export const contributorRouter = new Hono<{ Bindings: Env }>();

contributorRouter.get("/profile", async (c) => {
  // Check if API key is provided as query param or header
  const apiKey = c.req.query("apiKey") || c.req.header("X-Intel-Key");
  let hash: string;

  if (apiKey) {
    hash = await hashApiKey(apiKey);
  } else {
    hash = await generateContributorHash(c);
  }

  const profile = await getContributorProfile(c.env.DB, hash);
  if (!profile) {
    return c.json<ApiResponse>({
      success: true,
      data: {
        contributing: false,
        message: "You haven't contributed yet. Run a backtest with --contribute to start!",
        levels: Object.values(CONTRIBUTOR_LEVELS).filter((l) => l.id !== "none"),
      },
      timestamp: Date.now(),
    });
  }
  return c.json<ApiResponse>({ success: true, data: { contributing: true, ...profile }, timestamp: Date.now() });
});

contributorRouter.get("/leaderboard", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const entries = await getTopContributors(c.env.DB, limit);
  return c.json<ApiResponse>({
    success: true,
    data: { entries, totalContributors: entries.length },
    timestamp: Date.now(),
  });
});

contributorRouter.get("/levels", (c) => {
  return c.json<ApiResponse>({
    success: true,
    data: {
      levels: Object.values(CONTRIBUTOR_LEVELS).filter((l) => l.id !== "none").map((l) => ({
        id: l.id, emoji: l.emoji, name: l.name, streakRequired: l.streakRequired,
        bonusAnalyses: l.bonusAnalyses, patternLibraryAccess: l.patternAccess,
        airdropMultiplier: l.airdropMultiplier,
      })),
      note: "Future airdrops and rewards will ONLY go to active contributors.",
    },
    timestamp: Date.now(),
  });
});
