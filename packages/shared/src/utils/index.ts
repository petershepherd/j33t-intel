/**
 * Shared utilities for J33T Intel
 */

/** Format a number as compact USD (e.g. $12.5K, $1.2M) */
export function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/** Format a percentage */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Truncate a Solana address for display (e.g. "7xKX...3nPq") */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Calculate minutes since a timestamp */
export function minutesSince(timestamp: number): number {
  return (Date.now() - timestamp) / 60_000;
}

/** Simple rate limiter */
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestInWindow = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldestInWindow) + 50; // +50ms buffer
      await sleep(waitMs);
    }

    this.timestamps.push(Date.now());
  }
}

/** JSON schema version for the output format */
export const SCHEMA_VERSION = "0.1.0" as const;

/** Package version */
export const VERSION = "0.1.0" as const;
