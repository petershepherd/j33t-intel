/**
 * J33T Intel Central API
 * Cloudflare Worker + D1 Database
 *
 * Endpoints:
 *
 * GET  /                              — Health check + stats
 * POST /api/submissions               — Submit analysis result
 * GET  /api/submissions/:id           — Get submission by ID
 * GET  /api/submissions/token/:ca     — Get submissions for a token
 * GET  /api/patterns                  — Community pattern library
 * GET  /api/patterns/top/rugs         — Top 10 rugpull patterns
 * GET  /api/patterns/top/gems         — Top 10 high-potential patterns
 * GET  /api/patterns/:ca              — Pattern summary for a token
 * POST /api/tier/verify               — Verify $J33T balance + tier
 * GET  /api/tier/info                 — All tier definitions
 * GET  /api/leaderboard               — Contribution leaderboard
 * GET  /api/leaderboard/stats         — Aggregate DB statistics
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { submissionsRouter } from "./routes/submissions.js";
import { patternsRouter } from "./routes/patterns.js";
import { tierRouter } from "./routes/tier.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { contributorRouter } from "./routes/contributor.js";
import { createRequestLimiter } from "./middleware/auth.js";
import { getStats } from "./db/helpers.js";

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// ─── Global Middleware ────────────────────────────────────

// CORS for j33t.com, local development, and CLI tool
app.use(
  "*",
  cors({
    origin: [
      "https://j33t.com",
      "https://www.j33t.com",
      "http://localhost:3000",
      "http://localhost:8787", // wrangler dev
    ],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

// Request rate limiting (60 req/min per IP)
const requestLimiter = createRequestLimiter();
app.use("/api/*", requestLimiter);

// ─── Health Check ─────────────────────────────────────────

app.get("/", async (c) => {
  let stats = null;
  try {
    stats = await getStats(c.env.DB);
  } catch {
    // DB might not be initialized yet
  }

  return c.json({
    name: "J33T Intel API",
    version: "0.1.0",
    status: "operational",
    environment: c.env.ENVIRONMENT ?? "unknown",
    stats: stats
      ? {
          totalSubmissions: stats.totalSubmissions,
          totalTokens: stats.totalTokens,
          totalContributors: stats.totalContributors,
        }
      : null,
    timestamp: Date.now(),
  });
});

// ─── API Routes ───────────────────────────────────────────

app.route("/api/submissions", submissionsRouter);
app.route("/api/patterns", patternsRouter);
app.route("/api/tier", tierRouter);
app.route("/api/leaderboard", leaderboardRouter);
app.route("/api/contributor", contributorRouter);

// ─── Error Handling ───────────────────────────────────────

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Endpoint not found: ${c.req.method} ${c.req.path}`,
      },
      timestamp: Date.now(),
    },
    404,
  );
});

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: c.env.ENVIRONMENT === "production"
          ? "An internal error occurred"
          : err.message,
      },
      timestamp: Date.now(),
    },
    500,
  );
});

export default app;
