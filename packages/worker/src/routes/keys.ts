/**
 * API Key Management Route
 *
 * POST /api/keys/generate    — Generate new Intel API key (called by j33t.com)
 * POST /api/keys/verify      — Verify an API key (called by CLI)
 * POST /api/keys/revoke      — Revoke a key (called by j33t.com)
 * GET  /api/keys/info        — Get key info (called by CLI)
 */

import { Hono } from "hono";
import type { Env } from "../index.js";
import type { ApiResponse } from "@j33t-intel/shared";
import { isValidSolanaCA } from "@j33t-intel/shared";
import { createApiKey, verifyApiKey, revokeApiKey } from "../db/api-keys.js";

export const keysRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/keys/generate
 * Generate a new Intel API key for a wallet.
 * Called by j33t.com after wallet connect.
 *
 * Body: { walletAddress: string, secret: string }
 * The secret is a shared key between j33t.com and Intel Worker
 * to prevent unauthorized key generation.
 */
keysRouter.post("/generate", async (c) => {
  try {
    const body = await c.req.json<{ walletAddress: string; secret: string }>();

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

    // Verify the shared secret (prevents random people from generating keys)
    const expectedSecret = c.env.INTEL_SHARED_SECRET;
    if (!expectedSecret || body.secret !== expectedSecret) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid secret" }, timestamp: Date.now() },
        401,
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

/**
 * POST /api/keys/verify
 * Verify an API key and return wallet + tier info.
 * Called by the CLI on every request.
 *
 * Body: { apiKey: string }
 */
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
        { success: false, error: { code: "INVALID_KEY", message: "API key is invalid or revoked. Generate a new one at j33t.com" }, timestamp: Date.now() },
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

/**
 * POST /api/keys/revoke
 * Revoke all API keys for a wallet (called by j33t.com when user regenerates).
 *
 * Body: { walletAddress: string, secret: string }
 */
keysRouter.post("/revoke", async (c) => {
  try {
    const body = await c.req.json<{ walletAddress: string; secret: string }>();

    const expectedSecret = c.env.INTEL_SHARED_SECRET;
    if (!expectedSecret || body?.secret !== expectedSecret) {
      return c.json<ApiResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid secret" }, timestamp: Date.now() },
        401,
      );
    }

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
