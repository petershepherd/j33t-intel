import { Hono } from "hono";
import { cors } from "hono/cors";
import { submissionsRouter } from "./routes/submissions.js";
import { patternsRouter } from "./routes/patterns.js";
import { tierRouter } from "./routes/tier.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { contributorRouter } from "./routes/contributor.js";
import { keysRouter } from "./routes/keys.js";
import { votesRouter } from "./routes/votes.js";
import { activityRouter } from "./routes/activity.js";
import { createRequestLimiter } from "./middleware/auth.js";
import { getStats } from "./db/helpers.js";
import { refreshAllBalances, resetBrokenStreaks } from "./db/api-keys.js";

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  HELIUS_API_KEY?: string;
  INTEL_SHARED_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: ["https://j33t.com", "https://www.j33t.com", "http://localhost:3000", "http://localhost:8787"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

const requestLimiter = createRequestLimiter();
app.use("/api/*", requestLimiter);

app.get("/", async (c) => {
  let stats = null;
  try { stats = await getStats(c.env.DB); } catch {}
  return c.json({
    name: "J33T Intel API",
    version: "0.2.0",
    status: "operational",
    environment: c.env.ENVIRONMENT ?? "unknown",
    stats: stats ? {
      totalSubmissions: stats.totalSubmissions,
      totalTokens: stats.totalTokens,
      totalContributors: stats.totalContributors,
    } : null,
    timestamp: Date.now(),
  });
});

app.route("/api/submissions", submissionsRouter);
app.route("/api/patterns", patternsRouter);
app.route("/api/tier", tierRouter);
app.route("/api/leaderboard", leaderboardRouter);
app.route("/api/contributor", contributorRouter);
app.route("/api/keys", keysRouter);
app.route("/api/votes", votesRouter);
app.route("/api/activity", activityRouter);

app.notFound((c) => {
  return c.json(
    { success: false, error: { code: "NOT_FOUND", message: `Endpoint not found: ${c.req.method} ${c.req.path}` }, timestamp: Date.now() },
    404,
  );
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: c.env.ENVIRONMENT === "production" ? "An internal error occurred" : err.message }, timestamp: Date.now() },
    500,
  );
});

export default {
  fetch: app.fetch,

  /** Daily cron: refresh balances, update tiers, reset broken streaks */
  async scheduled(event: ScheduledEvent, env: Env) {
    try {
      // 1. Refresh all wallet balances and update tiers
      const balanceResult = await refreshAllBalances(env.DB, env.HELIUS_API_KEY);
      console.log(`Balance refresh: ${balanceResult.checked} checked, ${balanceResult.updated} updated`);

      // 2. Reset broken streaks (contributors who didn't submit yesterday)
      const streaksReset = await resetBrokenStreaks(env.DB);
      console.log(`Streaks reset: ${streaksReset} contributors`);
    } catch (error) {
      console.error("Cron error:", error);
    }
  },
};
