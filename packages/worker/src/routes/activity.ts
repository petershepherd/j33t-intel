import { Hono } from "hono";
import type { Env } from "../index.js";
import type { ApiResponse } from "@j33t-intel/shared";
import { getRecentActivity } from "../db/activity-feed.js";

export const activityRouter = new Hono<{ Bindings: Env }>();

activityRouter.get("/recent", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
  const since = c.req.query("since") ? Number(c.req.query("since")) : undefined;

  const events = await getRecentActivity(c.env.DB, limit, since);

  return c.json<ApiResponse>({
    success: true,
    data: {
      events: events.map(e => ({
        id: e.id,
        type: e.eventType,
        contributor: e.contributorHash.slice(0, 8) + "..." + e.contributorHash.slice(-4),
        tokenCA: e.tokenCA,
        details: e.details,
        trustChange: e.trustChange,
        createdAt: e.createdAt,
      })),
    },
    timestamp: Date.now(),
  });
});
