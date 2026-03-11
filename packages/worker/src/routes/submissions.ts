import { Hono } from "hono";
import type { Env } from "../index.js";
import type { CommunitySubmission, ApiResponse, SubmitAnalysisResponse } from "@j33t-intel/shared";
import { isValidSolanaCA } from "@j33t-intel/shared";
import { insertSubmission, getSubmission } from "../db/helpers.js";
import { rateLimitMiddleware, generateContributorHash } from "../middleware/auth.js";

export const submissionsRouter = new Hono<{ Bindings: Env }>();

submissionsRouter.post("/", rateLimitMiddleware, async (c) => {
  try {
    const body = await c.req.json<{ submission: CommunitySubmission }>();
    if (!body?.submission) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: { code: "INVALID_BODY", message: "Missing 'submission' field in request body" },
          timestamp: Date.now(),
        },
        400,
      );
    }
    const contributorHash = await generateContributorHash(c);
    const result = await insertSubmission(c.env.DB, body.submission, contributorHash);
    const response: ApiResponse<SubmitAnalysisResponse> = {
      success: result.accepted,
      data: {
        id: result.id,
        accepted: result.accepted,
        rejectionReason: result.rejectionReason,
      },
      timestamp: Date.now(),
    };
    if (!result.accepted) {
      response.error = {
        code: "SUBMISSION_REJECTED",
        message: result.rejectionReason ?? "Unknown rejection reason",
      };
    }
    return c.json(response, result.accepted ? 201 : 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json<ApiResponse>(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message },
        timestamp: Date.now(),
      },
      500,
    );
  }
});

submissionsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const submission = await getSubmission(c.env.DB, id);
  if (!submission) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Submission not found" },
        timestamp: Date.now(),
      },
      404,
    );
  }
  return c.json<ApiResponse>({ success: true, data: submission, timestamp: Date.now() });
});

submissionsRouter.get("/token/:ca", async (c) => {
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
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  const offset = Number(c.req.query("offset") ?? 0);
  const result = await c.env.DB
    .prepare(
      `SELECT id, token_ca, analyzed_at, pattern_type,
              potential_score, rugpull_risk_score, confidence,
              client_version, created_at
       FROM submissions WHERE token_ca = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(ca, limit, offset)
    .all();
  const countResult = await c.env.DB
    .prepare("SELECT COUNT(*) as total FROM submissions WHERE token_ca = ?")
    .bind(ca)
    .first<{ total: number }>();
  return c.json<ApiResponse>({
    success: true,
    data: { submissions: result.results ?? [], total: countResult?.total ?? 0 },
    timestamp: Date.now(),
  });
});
