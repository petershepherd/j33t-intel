import { logActivity } from "../db/activity-feed.js";
import { Hono } from "hono";
import type { Env } from "../index.js";
import type { ApiResponse } from "@j33t-intel/shared";
import { hashApiKey } from "../db/api-keys.js";
import { getDisputedSubmissions, castVote } from "../db/trust-score.js";

export const votesRouter = new Hono<{ Bindings: Env }>();

votesRouter.get("/disputed", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 10), 50);
  const submissions = await getDisputedSubmissions(c.env.DB, limit);
  return c.json<ApiResponse>({
    success: true,
    data: { submissions },
    timestamp: Date.now(),
  });
});

votesRouter.post("/cast", async (c) => {
  try {
    const body = await c.req.json<{ submissionId: string; vote: "agree" | "disagree"; apiKey: string }>();
    if (!body?.submissionId || !body?.vote || !body?.apiKey) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "MISSING_FIELDS", message: "submissionId, vote, and apiKey are required" }, timestamp: Date.now() },
        400,
      );
    }
    if (!["agree", "disagree"].includes(body.vote)) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "INVALID_VOTE", message: "vote must be 'agree' or 'disagree'" }, timestamp: Date.now() },
        400,
      );
    }
    const voterHash = await hashApiKey(body.apiKey);
    const result = await castVote(c.env.DB, body.submissionId, voterHash, body.vote);
    if (!result.success) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "VOTE_FAILED", message: result.error || "Vote failed" }, timestamp: Date.now() },
        400,
      );
    }
    return c.json<ApiResponse>({ success: true, data: { voted: true }, timestamp: Date.now() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message }, timestamp: Date.now() },
      500,
    );
  }
});
