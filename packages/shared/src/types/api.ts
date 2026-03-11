/**
 * API types for the J33T Intel central API (Cloudflare Worker)
 */

import type { CommunitySubmission, FilterSettings, PatternType } from "./analysis.js";

/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  /** Request timestamp */
  timestamp: number;
}

/** Submit analysis result */
export interface SubmitAnalysisRequest {
  submission: CommunitySubmission;
}

export interface SubmitAnalysisResponse {
  id: string;
  accepted: boolean;
  /** Reason if rejected (e.g. duplicate, invalid) */
  rejectionReason?: string;
}

/** Get community patterns */
export interface GetPatternsRequest {
  patternType?: PatternType;
  limit?: number;
  offset?: number;
}

export interface PatternSummary {
  tokenCA: string;
  patternType: PatternType;
  potentialScore: number;
  rugpullRiskScore: number;
  submissionCount: number;
  lastUpdated: number;
  averageFilterSettings?: FilterSettings;
}

export interface GetPatternsResponse {
  patterns: PatternSummary[];
  total: number;
}

/** Tier verification */
export interface VerifyTierRequest {
  walletAddress: string;
}

export interface VerifyTierResponse {
  tierId: string;
  tierName: string;
  balance: number;
  analysesRemaining: number;
}

/** Leaderboard */
export interface LeaderboardEntry {
  rank: number;
  /** Anonymized contributor ID */
  contributorId: string;
  submissionCount: number;
  accuracyScore: number;
}

export interface GetLeaderboardResponse {
  entries: LeaderboardEntry[];
  totalContributors: number;
}
