/**
 * $J33T Token tier system
 * Consistent across j33t.com and J33T Intel
 */

export interface Tier {
  id: TierId;
  name: string;
  emoji: string;
  /** Minimum $J33T tokens required */
  tokensRequired: number;
  /** Max analyses per day */
  analysesPerDay: number;
  /** Features unlocked at this tier */
  features: TierFeature[];
}

export type TierId =
  | "street_stray"
  | "first_sniff"
  | "loud_woofer"
  | "nose_certified"
  | "pack_runner"
  | "paws_of_steel"
  | "top_dog";

export type TierFeature =
  | "basic_json"
  | "rug_radar"
  | "j33t_take"
  | "rug_or_not"
  | "daily_sniff"
  | "early_access_patterns"
  | "paws_staking"
  | "full_ai_agent"
  | "priority_feed";

/** The complete tier configuration */
export const TIERS: readonly Tier[] = [
  {
    id: "street_stray",
    name: "Street Stray",
    emoji: "🐕",
    tokensRequired: 0,
    analysesPerDay: 1,
    features: ["basic_json"],
  },
  {
    id: "first_sniff",
    name: "First Sniff",
    emoji: "👃",
    tokensRequired: 10_000,
    analysesPerDay: 2,
    features: ["basic_json", "rug_radar"],
  },
  {
    id: "loud_woofer",
    name: "Loud Woofer",
    emoji: "🐶",
    tokensRequired: 50_000,
    analysesPerDay: 3,
    features: ["basic_json", "rug_radar", "j33t_take"],
  },
  {
    id: "nose_certified",
    name: "Nose Certified",
    emoji: "👆",
    tokensRequired: 100_000,
    analysesPerDay: 5,
    features: ["basic_json", "rug_radar", "j33t_take", "rug_or_not", "daily_sniff"],
  },
  {
    id: "pack_runner",
    name: "Pack Runner",
    emoji: "🏃",
    tokensRequired: 500_000,
    analysesPerDay: 8,
    features: ["basic_json", "rug_radar", "j33t_take", "rug_or_not", "daily_sniff", "early_access_patterns"],
  },
  {
    id: "paws_of_steel",
    name: "Paws of Steel",
    emoji: "🐾",
    tokensRequired: 1_000_000,
    analysesPerDay: 13,
    features: ["basic_json", "rug_radar", "j33t_take", "rug_or_not", "daily_sniff", "early_access_patterns", "paws_staking"],
  },
  {
    id: "top_dog",
    name: "Top Dog",
    emoji: "🏆",
    tokensRequired: 5_000_000,
    analysesPerDay: 21,
    features: [
      "basic_json",
      "rug_radar",
      "j33t_take",
      "rug_or_not",
      "daily_sniff",
      "early_access_patterns",
      "paws_staking",
      "full_ai_agent",
      "priority_feed",
    ],
  },
] as const;

/** Get tier by token balance */
export function getTierForBalance(balance: number): Tier {
  // Walk backwards through tiers to find the highest qualifying tier
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].tokensRequired) {
      return TIERS[i];
    }
  }
  return TIERS[0]; // Street Stray (free tier)
}

/** Check if a tier has a specific feature */
export function tierHasFeature(tier: Tier, feature: TierFeature): boolean {
  return tier.features.includes(feature);
}
