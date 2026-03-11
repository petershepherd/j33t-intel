import { RateLimiter, sleep } from "@j33t-intel/shared";
import type { J33TConfig, TokenMetadata, MarketSnapshot } from "@j33t-intel/shared";

const DEXSCREENER_BASE_URL = "https://api.dexscreener.com/latest";

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: { m5: number; h1: number; h6: number; h24: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  liquidity?: { usd: number; base: number; quote: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[] | null;
}

export class DexScreenerService {
  private rateLimiter: RateLimiter;
  private verbose: boolean;

  constructor(config: J33TConfig) {
    const rateLimit = config.dexScreenerRateLimit ?? 300;
    this.rateLimiter = new RateLimiter(rateLimit, 60_000);
    this.verbose = config.verbose ?? false;
  }

  async getTokenPairs(tokenCA: string): Promise<DexScreenerPair[]> {
    await this.rateLimiter.waitForSlot();
    if (this.verbose) {
      console.log(`   Fetching DexScreener data for ${tokenCA}...`);
    }
    const url = `${DEXSCREENER_BASE_URL}/dex/tokens/${tokenCA}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new DexScreenerApiError(`DexScreener API error (${response.status})`, response.status);
    }
    const data = (await response.json()) as DexScreenerResponse;
    if (!data.pairs || data.pairs.length === 0) {
      throw new DexScreenerApiError("No trading pairs found for this token", 404);
    }
    const solanaPairs = data.pairs
      .filter((p) => p.chainId === "solana")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    if (this.verbose) {
      console.log(`   Found ${solanaPairs.length} Solana trading pairs`);
    }
    return solanaPairs;
  }

  async getPrimaryPair(tokenCA: string): Promise<DexScreenerPair> {
    const pairs = await this.getTokenPairs(tokenCA);
    return pairs[0];
  }

  pairToMarketSnapshot(pair: DexScreenerPair): MarketSnapshot {
    return {
      timestamp: Date.now(),
      mcapUsd: pair.marketCap ?? pair.fdv ?? 0,
      priceUsd: parseFloat(pair.priceUsd) || 0,
      liquidityUsd: pair.liquidity?.usd ?? 0,
      volumeUsd: pair.volume?.h24 ?? 0,
    };
  }

  pairToPartialMetadata(pair: DexScreenerPair): Partial<TokenMetadata> {
    const socials: TokenMetadata["socials"] = {};
    if (pair.info?.websites?.[0]) {
      socials.website = pair.info.websites[0].url;
    }
    if (pair.info?.socials) {
      for (const social of pair.info.socials) {
        if (social.type === "twitter") socials.twitter = social.url;
        if (social.type === "telegram") socials.telegram = social.url;
        if (social.type === "discord") socials.discord = social.url;
      }
    }
    return {
      ca: pair.baseToken.address,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      createdAt: pair.pairCreatedAt ?? 0,
      socials: Object.keys(socials).length > 0 ? socials : undefined,
    };
  }

  extractTransactionCounts(pair: DexScreenerPair) {
    const calcRatio = (buys: number, sells: number) => sells === 0 ? buys : buys / sells;
    return {
      m5: { ...pair.txns.m5, ratio: calcRatio(pair.txns.m5.buys, pair.txns.m5.sells) },
      h1: { ...pair.txns.h1, ratio: calcRatio(pair.txns.h1.buys, pair.txns.h1.sells) },
      h6: { ...pair.txns.h6, ratio: calcRatio(pair.txns.h6.buys, pair.txns.h6.sells) },
      h24: { ...pair.txns.h24, ratio: calcRatio(pair.txns.h24.buys, pair.txns.h24.sells) },
    };
  }
}

export class DexScreenerApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "DexScreenerApiError";
  }
}
