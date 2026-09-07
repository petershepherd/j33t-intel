/**
 * Intel API Key Management
 *
 * Flow:
 * 1. j33t.com calls POST /api/keys/generate with wallet address
 * 2. Intel Worker generates a key, hashes it, stores hash + wallet in D1
 * 3. Returns the plain key to the user (only shown once)
 * 4. CLI sends the plain key with every request
 * 5. Intel Worker hashes it and looks up the hash in D1
 */

import { getTierForBalance } from "@j33t-intel/shared";

const J33T_TOKEN_MINT = "5zUr3xLCmLRg9JVjegxQzRixfPUyrmACS3XKQiZiDUSD";

/** Generate a random API key */
export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `j33t_ik_${hex}`;
}

/** Hash an API key using SHA-256 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  const array = Array.from(new Uint8Array(buffer));
  return array.map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Fetch $J33T balance from Solana via Helius or public RPC */
async function fetchJ33TBalance(walletAddress: string, heliusKey?: string): Promise<number> {
  const rpcUrl = heliusKey
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
    : "https://api.mainnet-beta.solana.com";

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTokenAccountsByOwner",
        params: [walletAddress, { mint: J33T_TOKEN_MINT }, { encoding: "jsonParsed" }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = (await response.json()) as {
      result?: { value?: { account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } } } }[] };
      error?: { message: string };
    };

    if (data.error) return 0;
    const accounts = data.result?.value ?? [];
    if (accounts.length === 0) return 0;

    let total = 0;
    for (const acc of accounts) {
      const amount = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      if (amount) total += amount;
    }
    return total;
  } catch {
    return 0;
  }
}

interface ApiKeyRow {
  key_hash: string;
  wallet_address: string;
  balance: number;
  tier_id: string;
  tier_name: string;
  analyses_per_day: number;
  created_at: number;
  last_used_at: number | null;
  last_balance_check: number | null;
  is_revoked: number;
  contributor_level: string;
}

export interface ApiKeyInfo {
  walletAddress: string;
  balance: number;
  tierId: string;
  tierName: string;
  analysesPerDay: number;
  contributorLevel: string;
  isRevoked: boolean;
}

/**
 * Generate a new API key for a wallet.
 * Called by j33t.com when user clicks "Generate Intel Key".
 * Migrates all activity from the old key to the new key.
 */
export async function createApiKey(
  db: D1Database,
  walletAddress: string,
  heliusKey?: string,
): Promise<{ key: string; keyHash: string; tier: ReturnType<typeof getTierForBalance> }> {
  // Get the old key hash before revoking (to migrate activity)
  const oldKey = await db
    .prepare("SELECT key_hash FROM intel_api_keys WHERE wallet_address = ? AND is_revoked = 0")
    .bind(walletAddress)
    .first<{ key_hash: string }>();
  const oldKeyHash = oldKey?.key_hash || null;

  // Revoke any existing keys for this wallet
  await db
    .prepare("UPDATE intel_api_keys SET is_revoked = 1 WHERE wallet_address = ? AND is_revoked = 0")
    .bind(walletAddress)
    .run();

  // Fetch current balance
  const balance = await fetchJ33TBalance(walletAddress, heliusKey);
  const tier = getTierForBalance(balance);

  // Generate and hash key
  const plainKey = generateApiKey();
  const keyHash = await hashApiKey(plainKey);

  // Store hashed key
  await db
    .prepare(
      `INSERT INTO intel_api_keys (key_hash, wallet_address, balance, tier_id, tier_name,
       analyses_per_day, created_at, last_balance_check, is_revoked, contributor_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'none')`)
    .bind(keyHash, walletAddress, balance, tier.id, tier.name,
      tier.analysesPerDay, Date.now(), Date.now())
    .run();

  // Migrate all activity from old key to new key
  if (oldKeyHash) {
    try {
      await db.prepare("UPDATE submissions SET contributor_hash = ? WHERE contributor_hash = ?")
        .bind(keyHash, oldKeyHash).run();
      await db.prepare("UPDATE contributors SET hash = ? WHERE hash = ?")
        .bind(keyHash, oldKeyHash).run();
      await db.prepare("UPDATE contributor_daily_log SET contributor_hash = ? WHERE contributor_hash = ?")
        .bind(keyHash, oldKeyHash).run();
      await db.prepare("UPDATE community_votes SET voter_hash = ? WHERE voter_hash = ?")
        .bind(keyHash, oldKeyHash).run();
      await db.prepare("UPDATE activity_log SET contributor_hash = ? WHERE contributor_hash = ?")
        .bind(keyHash, oldKeyHash).run();
    } catch {
      // Migration is best-effort — don't fail key generation
    }
  }

  return { key: plainKey, keyHash, tier };
}

/**
 * Verify an API key and return the associated wallet + tier info.
 * Called on every CLI request.
 */
export async function verifyApiKey(
  db: D1Database,
  plainKey: string,
): Promise<ApiKeyInfo | null> {
  const keyHash = await hashApiKey(plainKey);

  const row = await db
    .prepare("SELECT * FROM intel_api_keys WHERE key_hash = ? AND is_revoked = 0")
    .bind(keyHash)
    .first<ApiKeyRow>();

  if (!row) return null;

  // Update last_used_at
  await db
    .prepare("UPDATE intel_api_keys SET last_used_at = ? WHERE key_hash = ?")
    .bind(Date.now(), keyHash)
    .run();

  // Check contributor bonus
  const contributor = await db
    .prepare("SELECT daily_bonus_analyses, contributor_level FROM contributors WHERE hash = ?")
    .bind(keyHash)
    .first<{ daily_bonus_analyses: number; contributor_level: string }>();

  const bonusAnalyses = contributor?.daily_bonus_analyses ?? 0;

  return {
    walletAddress: row.wallet_address,
    balance: row.balance,
    tierId: row.tier_id,
    tierName: row.tier_name,
    analysesPerDay: row.analyses_per_day + bonusAnalyses,
    contributorLevel: contributor?.contributor_level ?? "none",
    isRevoked: false,
  };
}

/**
 * Revoke an API key. Called when user regenerates their key.
 */
export async function revokeApiKey(
  db: D1Database,
  walletAddress: string,
): Promise<void> {
  await db
    .prepare("UPDATE intel_api_keys SET is_revoked = 1 WHERE wallet_address = ? AND is_revoked = 0")
    .bind(walletAddress)
    .run();
}

/**
 * CRON: Refresh all active API key balances and update tiers.
 * Runs once daily.
 */
export async function refreshAllBalances(
  db: D1Database,
  heliusKey?: string,
): Promise<{ checked: number; updated: number }> {
  const rows = await db
    .prepare("SELECT key_hash, wallet_address, balance, tier_id FROM intel_api_keys WHERE is_revoked = 0")
    .all<ApiKeyRow>();

  const keys = rows.results ?? [];
  let checked = 0;
  let updated = 0;

  // Process in batches of 10 (rate limit friendly)
  for (let i = 0; i < keys.length; i += 10) {
    const batch = keys.slice(i, i + 10);

    await Promise.allSettled(batch.map(async (row) => {
      try {
        const newBalance = await fetchJ33TBalance(row.wallet_address, heliusKey);
        checked++;

        const newTier = getTierForBalance(newBalance);
        const tierChanged = newTier.id !== row.tier_id;
        const balanceChanged = Math.abs(newBalance - row.balance) > 1;

        if (tierChanged || balanceChanged) {
          await db
            .prepare(
              `UPDATE intel_api_keys SET balance = ?, tier_id = ?, tier_name = ?,
               analyses_per_day = ?, last_balance_check = ? WHERE key_hash = ?`)
            .bind(newBalance, newTier.id, newTier.name,
              newTier.analysesPerDay, Date.now(), row.key_hash)
            .run();
          updated++;
        } else {
          await db
            .prepare("UPDATE intel_api_keys SET last_balance_check = ? WHERE key_hash = ?")
            .bind(Date.now(), row.key_hash)
            .run();
        }
      } catch { /* skip failed wallets */ }
    }));

    // Small delay between batches
    if (i + 10 < keys.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return { checked, updated };
}

/**
 * CRON: Check and reset broken streaks.
 * If a contributor didn't submit yesterday, reset their streak.
 */
export async function resetBrokenStreaks(db: D1Database): Promise<number> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const result = await db
    .prepare(
      `UPDATE contributors SET
        current_streak_days = 0,
        contributor_level = CASE
          WHEN total_submissions > 0 THEN 'contributor'
          ELSE 'none'
        END,
        daily_bonus_analyses = CASE
          WHEN total_submissions > 0 THEN 1
          ELSE 0
        END,
        airdrop_eligible = 0,
        airdrop_multiplier = 0,
        updated_at = ?
       WHERE current_streak_days > 0
         AND streak_last_date IS NOT NULL
         AND streak_last_date < ?`)
    .bind(Date.now(), yesterdayStr)
    .run();

  return result.meta?.changes ?? 0;
}
