import { RateLimiter, sleep } from "@j33t-intel/shared";
import type { J33TConfig } from "@j33t-intel/shared";

const HELIUS_BASE_URL = "https://api.helius.xyz/v0";

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  slot: number;
  type: string;
  source: string;
  description: string;
  fee: number;
  feePayer: string;
  nativeTransfers: HeliusNativeTransfer[];
  tokenTransfers: HeliusTokenTransfer[];
  accountData: HeliusAccountData[];
}

export interface HeliusNativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

export interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard: string;
}

export interface HeliusAccountData {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: {
    userAccount: string;
    tokenAccount: string;
    mint: string;
    rawTokenAmount: {
      tokenAmount: string;
      decimals: number;
    };
  }[];
}

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: { value?: unknown[] };
  error?: { message: string };
}

export class HeliusService {
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private verbose: boolean;

  constructor(config: J33TConfig) {
    this.apiKey = config.heliusApiKey;
    this.rateLimiter = new RateLimiter(40, 1000);
    this.verbose = config.verbose ?? false;
  }

  async getTokenTransactionHistory(
    tokenMint: string,
    options: { maxTransactions?: number; beforeSignature?: string } = {},
  ): Promise<HeliusTransaction[]> {
    const maxTx = options.maxTransactions ?? 500;
    const allTransactions: HeliusTransaction[] = [];
    let beforeSig = options.beforeSignature;
    let page = 0;

    if (this.verbose) {
      console.log(`   Fetching transaction history for ${tokenMint}...`);
    }

    while (allTransactions.length < maxTx) {
      const batchSize = Math.min(100, maxTx - allTransactions.length);
      await this.rateLimiter.waitForSlot();

      const url = new URL(`${HELIUS_BASE_URL}/addresses/${tokenMint}/transactions`);
      url.searchParams.set("api-key", this.apiKey);
      url.searchParams.set("limit", String(batchSize));
      if (beforeSig) {
        url.searchParams.set("before", beforeSig);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        throw new HeliusApiError(`Helius API error (${response.status}): ${errorText}`, response.status);
      }

      const transactions = (await response.json()) as HeliusTransaction[];
      if (transactions.length === 0) break;

      allTransactions.push(...transactions);
      beforeSig = transactions[transactions.length - 1].signature;
      page++;

      if (this.verbose) {
        console.log(`   Page ${page}: fetched ${transactions.length} transactions (total: ${allTransactions.length})`);
      }

      if (transactions.length < batchSize) break;
      await sleep(100);
    }

    if (this.verbose) {
      console.log(`   Total transactions fetched: ${allTransactions.length}`);
    }

    return allTransactions;
  }

  async getSignaturesForAddress(
    address: string,
    limit = 100,
  ): Promise<{ signature: string; slot: number; timestamp: number }[]> {
    await this.rateLimiter.waitForSlot();

    const url = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [address, { limit }],
      }),
    });

    if (!response.ok) {
      throw new HeliusApiError(`Helius RPC error (${response.status})`, response.status);
    }

    const data = (await response.json()) as RpcResponse;
    if (data.error) {
      throw new HeliusApiError(`Helius RPC error: ${data.error.message}`, 400);
    }

    const results = (data.result?.value ?? []) as { signature: string; slot: number; blockTime?: number }[];
    return results.map((sig) => ({
      signature: sig.signature,
      slot: sig.slot,
      timestamp: sig.blockTime ? sig.blockTime * 1000 : 0,
    }));
  }

  async parseTransactions(signatures: string[]): Promise<HeliusTransaction[]> {
    if (signatures.length === 0) return [];

    const batches: string[][] = [];
    for (let i = 0; i < signatures.length; i += 100) {
      batches.push(signatures.slice(i, i + 100));
    }

    const allParsed: HeliusTransaction[] = [];

    for (const batch of batches) {
      await this.rateLimiter.waitForSlot();

      const url = `${HELIUS_BASE_URL}/transactions?api-key=${this.apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: batch }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new HeliusApiError(`Helius parse error (${response.status}): ${errorText}`, response.status);
      }

      const parsed = (await response.json()) as HeliusTransaction[];
      allParsed.push(...parsed);

      if (batches.length > 1) await sleep(100);
    }

    return allParsed;
  }

  async getTokenLargestAccounts(
    tokenMint: string,
  ): Promise<{ address: string; amount: string; decimals: number; uiAmount: number }[]> {
    await this.rateLimiter.waitForSlot();

    const url = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenLargestAccounts",
        params: [tokenMint],
      }),
    });

    if (!response.ok) {
      throw new HeliusApiError(`Helius RPC error (${response.status})`, response.status);
    }

    const data = (await response.json()) as RpcResponse;
    if (data.error) {
      throw new HeliusApiError(`Helius RPC error: ${data.error.message}`, 400);
    }

    const accounts = (data.result?.value ?? []) as { address: string; amount: string; decimals: number; uiAmount: number }[];
    return accounts.map((account) => ({
      address: account.address,
      amount: account.amount,
      decimals: account.decimals,
      uiAmount: account.uiAmount,
    }));
  }
}

export class HeliusApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "HeliusApiError";
  }
}
