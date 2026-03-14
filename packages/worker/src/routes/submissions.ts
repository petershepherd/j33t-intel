import { logActivity } from "../db/activity-feed.js";
import { Hono } from "hono";
import type { Env } from "../index.js";
import type { CommunitySubmission, ApiResponse, SubmitAnalysisResponse } from "@j33t-intel/shared";
import { isValidSolanaCA } from "@j33t-intel/shared";
import { insertSubmission, getSubmission } from "../db/helpers.js";
import { rateLimitMiddleware, generateContributorHash } from "../middleware/auth.js";
import { recordContributorActivity } from "../db/contributors.js";
import { hashApiKey } from "../db/api-keys.js";
import { checkDispute, getSubmissionWeight, updateTrustAfterSubmission, isContributorBlocked } from "../db/trust-score.js";

export const submissionsRouter = new Hono<{ Bindings: Env }>();

submissionsRouter.post("/", rateLimitMiddleware, async (c) => {
  try {
    const body = await c.req.json<{ submission: CommunitySubmission; apiKey?: string }>();
    if (!body?.submission) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "INVALID_BODY", message: "Missing 'submission' field" }, timestamp: Date.now() },
        400,
      );
    }

    // Identify contributor
    let contributorHash: string;
    if (body.apiKey) {
      contributorHash = await hashApiKey(body.apiKey);
    } else {
      contributorHash = await generateContributorHash(c);
    }

    // Check if contributor is blocked (trust too low)
    const blockCheck = await isContributorBlocked(c.env.DB, contributorHash);
    if (blockCheck.blocked) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "BLOCKED", message: blockCheck.reason || "Temporarily blocked" }, timestamp: Date.now() },
        403,
      );
    }

    // Check for dispute: does scoring agree with the user's pattern?
    const { potentialScore, rugpullRiskScore } = body.submission.scores;
    const dispute = checkDispute(body.submission.patternType, potentialScore, rugpullRiskScore);

    // Get contributor's trust score for weight calculation
    const trustRow = await c.env.DB
      .prepare("SELECT trust_score FROM contributors WHERE hash = ?")
      .bind(contributorHash)
      .first<{ trust_score: number }>();
    const trustScore = trustRow?.trust_score ?? 50;
    const weight = getSubmissionWeight(trustScore);

    // Insert submission
    const result = await insertSubmission(c.env.DB, body.submission, contributorHash);

    if (result.accepted && result.id) {
      // Update submission with trust data
      await c.env.DB
        .prepare(
          `UPDATE submissions SET
            submission_weight = ?,
            is_disputed = ?,
            scoring_pattern_type = ?,
            dispute_reason = ?
           WHERE id = ?`)
        .bind(
          weight,
          dispute.disputed ? 1 : 0,
          dispute.scoringPattern,
          dispute.reason,
          result.id,
        )
        .run();

      // Update trust score based on whether scoring agrees
      const newTrust = await updateTrustAfterSubmission(c.env.DB, contributorHash, !dispute.disputed);

      // Track contributor activity (streaks, levels)
      let contributorProfile = null;
      try {
        contributorProfile = await recordContributorActivity(c.env.DB, contributorHash, body.submission.tokenCA);
      } catch(e) {
        console.error("Contributor tracking error:", e);
      }


      // Log activity for live feed
      try {
        const shortCA = body.submission.tokenCA.slice(0, 6) + "..." + body.submission.tokenCA.slice(-4);
        if (dispute.disputed) {
          await logActivity(c.env.DB, "disputed", contributorHash, "Disputed analysis on " + shortCA + " (user: " + body.submission.patternType + ", scoring: " + dispute.scoringPattern + ")", -5, body.submission.tokenCA);
        } else {
          await logActivity(c.env.DB, "submission", contributorHash, "Analyzed " + shortCA + " — " + body.submission.patternType.toUpperCase(), 2, body.submission.tokenCA);
        }
        if (contributorProfile?.leveledUp) {
          await logActivity(c.env.DB, "level_up", contributorHash, "Reached " + (contributorProfile.levelEmoji || "") + " " + (contributorProfile.levelName || "") + " level!", 0);
        }
      } catch(e2) {}
      const response: ApiResponse = {
        success: true,
        data: {
          id: result.id,
          accepted: true,
          submissionWeight: weight,
          trustScore: newTrust,
          disputed: dispute.disputed,
          scoringPattern: dispute.scoringPattern,
          disputeReason: dispute.reason,
          contributor: contributorProfile,
        },
        timestamp: Date.now(),
      };

      return c.json(response, 201);
    }

    // Submission rejected
    return c.json<ApiResponse>(
      {
        success: false,
        error: { code: "SUBMISSION_REJECTED", message: result.rejectionReason ?? "Unknown" },
        data: { id: result.id, accepted: false, rejectionReason: result.rejectionReason },
        timestamp: Date.now(),
      },
      400,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message }, timestamp: Date.now() },
      500,
    );
  }
});

submissionsRouter.get("/my/recent", async (c) => {
  const apiKey = c.req.query("apiKey") || c.req.header("X-Intel-Key");
  if (!apiKey) {
    return c.json<ApiResponse>(
      { success: false, error: { code: "MISSING_KEY", message: "apiKey query param required" }, timestamp: Date.now() },
      400,
    );
  }
  const keyHash = await hashApiKey(apiKey);
  const limit = Math.min(Number(c.req.query("limit") ?? 10), 50);
  const result = await c.env.DB
    .prepare(
      `SELECT id, token_ca, analyzed_at, pattern_type, scoring_pattern_type,
              potential_score, rugpull_risk_score, confidence, submission_weight,
              is_disputed, dispute_reason, created_at
       FROM submissions WHERE contributor_hash = ? ORDER BY created_at DESC LIMIT ?`)
    .bind(keyHash, limit).all();
  return c.json<ApiResponse>({
    success: true,
    data: { submissions: result.results ?? [] },
    timestamp: Date.now(),
  });
});

submissionsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const submission = await getSubmission(c.env.DB, id);
  if (!submission) {
    return c.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Submission not found" }, timestamp: Date.now() },
      404,
    );
  }
  return c.json<ApiResponse>({ success: true, data: submission, timestamp: Date.now() });
});

submissionsRouter.get("/token/:ca", async (c) => {
  const ca = c.req.param("ca");
  if (!isValidSolanaCA(ca)) {
    return c.json<ApiResponse>(
      { success: false, error: { code: "INVALID_CA", message: "Invalid Solana token address" }, timestamp: Date.now() },
      400,
    );
  }
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  const offset = Number(c.req.query("offset") ?? 0);
  const result = await c.env.DB
    .prepare(
      `SELECT id, token_ca, analyzed_at, pattern_type, potential_score, rugpull_risk_score,
              confidence, submission_weight, is_disputed, client_version, created_at
       FROM submissions WHERE token_ca = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(ca, limit, offset).all();
  const countResult = await c.env.DB
    .prepare("SELECT COUNT(*) as total FROM submissions WHERE token_ca = ?")
    .bind(ca).first<{ total: number }>();
  return c.json<ApiResponse>({
    success: true,
    data: { submissions: result.results ?? [], total: countResult?.total ?? 0 },
    timestamp: Date.now(),
  });
});
