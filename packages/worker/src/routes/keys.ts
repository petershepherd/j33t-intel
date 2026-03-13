import { Hono } from "hono";
import type { Env } from "../index.js";
import type { ApiResponse } from "@j33t-intel/shared";
import { isValidSolanaCA } from "@j33t-intel/shared";
import { createApiKey, verifyApiKey, revokeApiKey } from "../db/api-keys.js";

export const keysRouter = new Hono<{ Bindings: Env }>();

keysRouter.post("/generate", async (c) => {
  try {
    const body = await c.req.json<{ walletAddress: string }>();
    if (!body?.walletAddress) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "MISSING_WALLET", message: "walletAddress is required" }, timestamp: Date.now() },
        400,
      );
    }
    if (!isValidSolanaCA(body.walletAddress)) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "INVALID_WALLET", message: "Invalid Solana wallet address" }, timestamp: Date.now() },
        400,
      );
    }
    const heliusKey = c.env.HELIUS_API_KEY;
    const { key, tier } = await createApiKey(c.env.DB, body.walletAddress, heliusKey);
    return c.json<ApiResponse>({
      success: true,
      data: {
        apiKey: key,
        walletAddress: body.walletAddress,
        tier: { id: tier.id, name: tier.name, emoji: tier.emoji, analysesPerDay: tier.analysesPerDay },
        warning: "This key is shown only once. Store it safely and do not share it with anyone.",
      },
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

keysRouter.post("/verify", async (c) => {
  try {
    const body = await c.req.json<{ apiKey: string }>();
    if (!body?.apiKey) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "MISSING_KEY", message: "apiKey is required" }, timestamp: Date.now() },
        400,
      );
    }
    const info = await verifyApiKey(c.env.DB, body.apiKey);
    if (!info) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "INVALID_KEY", message: "API key is invalid or revoked" }, timestamp: Date.now() },
        401,
      );
    }
    return c.json<ApiResponse>({
      success: true,
      data: {
        verified: true,
        walletAddress: info.walletAddress,
        balance: info.balance,
        tierId: info.tierId,
        tierName: info.tierName,
        analysesPerDay: info.analysesPerDay,
        contributorLevel: info.contributorLevel,
      },
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

keysRouter.post("/revoke", async (c) => {
  try {
    const body = await c.req.json<{ walletAddress: string }>();
    if (!body?.walletAddress) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "MISSING_WALLET", message: "walletAddress is required" }, timestamp: Date.now() },
        400,
      );
    }
    await revokeApiKey(c.env.DB, body.walletAddress);
    return c.json<ApiResponse>({
      success: true,
      data: { revoked: true, walletAddress: body.walletAddress },
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
