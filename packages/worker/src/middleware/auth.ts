import type { Context, Next } from "hono";
import type { Env } from "../index.js";
import { getDailyUsage } from "../db/helpers.js";

export async function generateContributorHash(c: Context<{ Bindings: Env }>): Promise<string> {
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  const ua = c.req.header("user-agent") ?? "unknown";
  const raw = `j33t:${ip}:${ua}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex.slice(0, 16);
}

export async function rateLimitMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<Response | void> {
  const contributorHash = await generateContributorHash(c);
  c.set("contributorHash" as never, contributorHash as never);
  const todayCount = await getDailyUsage(c.env.DB, contributorHash);
  const maxDailySubmissions = 50;
  if (todayCount >= maxDailySubmissions) {
    return c.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Daily submission limit reached (${maxDailySubmissions}/day). Try again tomorrow.`,
        },
        timestamp: Date.now(),
      },
      429,
    );
  }
  await next();
}

export function createRequestLimiter() {
  const requestCounts = new Map<string, { count: number; resetAt: number }>();
  return async function requestRateLimit(
    c: Context<{ Bindings: Env }>,
    next: Next,
  ): Promise<Response | void> {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const now = Date.now();
    const entry = requestCounts.get(ip);
    if (entry && entry.resetAt > now) {
      if (entry.count >= 60) {
        return c.json(
          {
            success: false,
            error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded. Please slow down." },
            timestamp: now,
          },
          429,
        );
      }
      entry.count++;
    } else {
      requestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    }
    if (requestCounts.size > 10_000) {
      for (const [key, val] of requestCounts) {
        if (val.resetAt < now) requestCounts.delete(key);
      }
    }
    await next();
  };
}
