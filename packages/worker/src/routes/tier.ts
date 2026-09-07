/**
 * Tier Verification Route
 *
 * POST /api/tier/verify — Verify $J33T token balance and return tier info
 * GET  /api/tier/info   — Get all tier definitions
 */

import { Hono } from "hono";
import type { Env } from "../index.js";
import type { ApiResponse } from "@j33t-intel/shared";
import { TIERS, getTierForBalance, isValidSolanaCA } from "@j33t-intel/shared";
import { getDailyUsage } from "../db/helpers.js";
import { generateContributorHash } from "../middleware/auth.js";

/** The $J33T token mint address on Solana */
const J33T_TOKEN_MINT = "5zUr3xLCmLRg9JVjegxQzRixfPUyrmACS3XKQiZiDUSD";

export const tierRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/tier/verify
 * Verify a wallet's $J33T balance and return their tier.
 *
 * Body: { walletAddress: string }
 */
tierRouter.post("/verify", async (c) => {
  try {
    const body = await c.req.json<{ walletAddress: string }>();

    if (!body?.walletAddress) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: { code: "MISSING_WALLET", message: "walletAddress is required" },
          timestamp: Date.now(),
        },
        400,
      );
    }

    if (!isValidSolanaCA(body.walletAddress)) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: { code: "INVALID_WALLET", message: "Invalid Solana wallet address" },
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Fetch $J33T token balance from Solana
    const balance = await getJ33TBalance(body.walletAddress);
    const tier = getTierForBalance(balance);

    // Get today's usage
    const contributorHash = await generateContributorHash(c);
    const todayUsage = await getDailyUsage(c.env.DB, contributorHash);
    const analysesRemaining = Math.max(0, tier.analysesPerDay - todayUsage);

    return c.json<ApiResponse>({
      success: true,
      data: {
        walletAddress: body.walletAddress,
        balance,
        tierId: tier.id,
        tierName: tier.name,
        tierEmoji: tier.emoji,
        analysesPerDay: tier.analysesPerDay,
        analysesUsedToday: todayUsage,
        analysesRemaining,
        features: tier.features,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json<ApiResponse>(
      {
        success: false,
        error: { code: "VERIFICATION_FAILED", message },
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * GET /api/tier/info
 * Get all tier definitions (public, no auth needed).
 */
tierRouter.get("/info", (c) => {
  return c.json<ApiResponse>({
    success: true,
    data: {
      tiers: TIERS.map((tier) => ({
        id: tier.id,
        name: tier.name,
        emoji: tier.emoji,
        tokensRequired: tier.tokensRequired,
        analysesPerDay: tier.analysesPerDay,
        features: tier.features,
      })),
      tokenMint: J33T_TOKEN_MINT,
    },
    timestamp: Date.now(),
  });
});

/**
 * Fetch $J33T token balance for a wallet address.
 *
 * Uses Solana's getTokenAccountsByOwner RPC call to find
 * the wallet's $J33T token account and read the balance.
 *
 * In production, you'd use a Helius or other RPC provider.
 * For now, we use the public Solana RPC.
 */
async function getJ33TBalance(walletAddress: string): Promise<number> {
  try {
    const rpcUrl = "https://api.mainnet-beta.solana.com";

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: J33T_TOKEN_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Solana RPC error: ${response.status}`);
    }

    const data: any = await response.json();

    if (data.error) {
      throw new Error(`Solana RPC error: ${data.error.message}`);
    }

    const accounts = data.result?.value ?? [];

    if (accounts.length === 0) {
      return 0; // No $J33T token account = 0 balance
    }

    // Sum up all token accounts (there should usually be just one)
    let totalBalance = 0;
    for (const account of accounts) {
      const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount;
      if (tokenAmount?.uiAmount) {
        totalBalance += tokenAmount.uiAmount;
      }
    }

    return totalBalance;
  } catch (error) {
    // If we can't verify, default to free tier (0 balance)
    console.error("Failed to verify $J33T balance:", error);
    return 0;
  }
}
