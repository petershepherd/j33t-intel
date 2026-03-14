import { Hono } from "hono";
import type { Env } from "../index.js";
import type { ApiResponse } from "@j33t-intel/shared";
import { hashApiKey } from "../db/api-keys.js";
import { updateTrustAfterVote } from "../db/trust-score.js";
import { logActivity } from "../db/activity-feed.js";

const ADMIN_WALLET = "EhawJmvAfRJuapnBtjoP4nQRvfAzNTGyhB82wwPrehWK";

export const adminRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/admin/pending
 * Get submissions pending admin review (is_disputed = 2)
 */
adminRouter.get("/pending", async (c) => {
  const apiKey = c.req.query("apiKey") || c.req.header("X-Intel-Key");
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "API key required" }, timestamp: Date.now() },
      401,
    );
  }

  // Verify admin wallet
  const keyHash = await hashApiKey(apiKey);
  const keyRow = await c.env.DB
    .prepare("SELECT wallet_address FROM intel_api_keys WHERE key_hash = ? AND is_revoked = 0")
    .bind(keyHash)
    .first<{ wallet_address: string }>();

  if (!keyRow || keyRow.wallet_address !== ADMIN_WALLET) {
    return c.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Admin access only" }, timestamp: Date.now() },
      403,
    );
  }

  const rows = await c.env.DB
    .prepare(
      `SELECT s.id, s.token_ca, s.pattern_type, s.scoring_pattern_type,
              s.potential_score, s.rugpull_risk_score, s.dispute_reason,
              s.contributor_hash, s.created_at,
              (SELECT COUNT(*) FROM community_votes WHERE submission_id = s.id AND vote = 'agree') as agree_votes,
              (SELECT COUNT(*) FROM community_votes WHERE submission_id = s.id AND vote = 'disagree') as disagree_votes
       FROM submissions s WHERE s.is_disputed = 2
       ORDER BY s.created_at DESC LIMIT 50`)
    .all();

  return c.json<ApiResponse>({
    success: true,
    data: { submissions: rows.results ?? [] },
    timestamp: Date.now(),
  });
});

/**
 * POST /api/admin/resolve
 * Admin resolves a disputed submission
 * Body: { submissionId, decision: "agree_user" | "agree_scoring", apiKey }
 */
adminRouter.post("/resolve", async (c) => {
  try {
    const body = await c.req.json<{ submissionId: string; decision: string; apiKey: string }>();

    if (!body?.apiKey || !body?.submissionId || !body?.decision) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "MISSING_FIELDS", message: "submissionId, decision, and apiKey required" }, timestamp: Date.now() },
        400,
      );
    }

    // Verify admin wallet
    const keyHash = await hashApiKey(body.apiKey);
    const keyRow = await c.env.DB
      .prepare("SELECT wallet_address FROM intel_api_keys WHERE key_hash = ? AND is_revoked = 0")
      .bind(keyHash)
      .first<{ wallet_address: string }>();

    if (!keyRow || keyRow.wallet_address !== ADMIN_WALLET) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "FORBIDDEN", message: "Admin access only" }, timestamp: Date.now() },
        403,
      );
    }

    // Get submission
    const submission = await c.env.DB
      .prepare("SELECT id, contributor_hash, pattern_type, scoring_pattern_type FROM submissions WHERE id = ? AND is_disputed = 2")
      .bind(body.submissionId)
      .first<{ id: string; contributor_hash: string; pattern_type: string; scoring_pattern_type: string }>();

    if (!submission) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "NOT_FOUND", message: "Submission not found or not pending review" }, timestamp: Date.now() },
        404,
      );
    }

    if (body.decision === "agree_user") {
      // Admin agrees with user — keep user's pattern, resolve, boost trust
      await c.env.DB
        .prepare("UPDATE submissions SET is_disputed = 0 WHERE id = ?")
        .bind(body.submissionId)
        .run();
      await updateTrustAfterVote(c.env.DB, submission.contributor_hash, true);
      await logActivity(c.env.DB, "vote", "admin", "Admin approved: user was RIGHT on " + body.submissionId.slice(0, 12), 3);

    } else if (body.decision === "agree_scoring") {
      // Admin agrees with scoring — override pattern, resolve, penalize trust
      await c.env.DB
        .prepare("UPDATE submissions SET is_disputed = 0, pattern_type = ? WHERE id = ?")
        .bind(submission.scoring_pattern_type, body.submissionId)
        .run();
      await updateTrustAfterVote(c.env.DB, submission.contributor_hash, false);
      await logActivity(c.env.DB, "vote", "admin", "Admin overruled: scoring was RIGHT on " + body.submissionId.slice(0, 12), -3);

    } else {
      return c.json<ApiResponse>(
        { success: false, error: { code: "INVALID_DECISION", message: "decision must be 'agree_user' or 'agree_scoring'" }, timestamp: Date.now() },
        400,
      );
    }

    return c.json<ApiResponse>({
      success: true,
      data: { resolved: true, submissionId: body.submissionId, decision: body.decision },
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message }, timestamp: Date.now() },
      500,
    );
  }
});
