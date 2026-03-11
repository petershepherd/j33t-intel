export const CONTRIBUTOR_LEVELS = {
  none:        { id: "none",        emoji: "",   name: "Not Contributing",     streakRequired: 0,  bonusAnalyses: 0, patternAccess: false, airdropMultiplier: 0 },
  contributor: { id: "contributor", emoji: "🥉", name: "Contributor",          streakRequired: 0,  bonusAnalyses: 1, patternAccess: true,  airdropMultiplier: 0 },
  active:      { id: "active",      emoji: "🥈", name: "Active Contributor",   streakRequired: 7,  bonusAnalyses: 2, patternAccess: true,  airdropMultiplier: 1 },
  power:       { id: "power",       emoji: "🥇", name: "Power Contributor",    streakRequired: 30, bonusAnalyses: 3, patternAccess: true,  airdropMultiplier: 2 },
  diamond:     { id: "diamond",     emoji: "💎", name: "Diamond Contributor",  streakRequired: 90, bonusAnalyses: 5, patternAccess: true,  airdropMultiplier: 5 },
} as const;

export type ContributorLevelId = keyof typeof CONTRIBUTOR_LEVELS;

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function calculateLevel(currentStreak: number, totalSubmissions: number): ContributorLevelId {
  if (totalSubmissions === 0) return "none";
  if (currentStreak >= 90) return "diamond";
  if (currentStreak >= 30) return "power";
  if (currentStreak >= 7) return "active";
  return "contributor";
}

interface ContributorRow {
  hash: string;
  total_submissions: number;
  first_submission_at: number;
  last_submission_at: number;
  current_streak_days: number;
  longest_streak_days: number;
  streak_last_date: string | null;
  contributor_level: string;
  airdrop_eligible: number;
  airdrop_multiplier: number;
  daily_bonus_analyses: number;
  pattern_library_access: number;
  updated_at: number;
}

export interface ContributorProfile {
  level: string;
  levelEmoji: string;
  levelName: string;
  totalSubmissions: number;
  currentStreak: number;
  longestStreak: number;
  bonusAnalyses: number;
  patternLibraryAccess: boolean;
  airdropEligible: boolean;
  airdropMultiplier: number;
  isNewContributor: boolean;
  leveledUp?: string;
}

export interface ContributorLeaderboardEntry {
  rank: number;
  contributorId: string;
  level: string;
  levelEmoji: string;
  totalSubmissions: number;
  currentStreak: number;
  longestStreak: number;
  airdropMultiplier: number;
  memberSince: number;
  lastActive: number;
}

export async function recordContributorActivity(
  db: D1Database,
  contributorHash: string,
  tokenCA: string,
): Promise<ContributorProfile> {
  const today = todayString();
  const yesterday = yesterdayString();
  const now = Date.now();

  const profile = await db
    .prepare("SELECT * FROM contributors WHERE hash = ?")
    .bind(contributorHash)
    .first<ContributorRow>();

  if (!profile) {
    await db
      .prepare(
        `INSERT INTO contributors (hash, total_submissions, first_submission_at, last_submission_at,
         current_streak_days, longest_streak_days, streak_last_date, contributor_level,
         airdrop_eligible, airdrop_multiplier, daily_bonus_analyses, pattern_library_access, updated_at)
         VALUES (?, 1, ?, ?, 1, 1, ?, 'contributor', 0, 0, 1, 1, ?)`)
      .bind(contributorHash, now, now, today, now)
      .run();

    await db
      .prepare(
        `INSERT INTO contributor_daily_log (contributor_hash, date, submissions_count, tokens_analyzed)
         VALUES (?, ?, 1, ?)`)
      .bind(contributorHash, today, JSON.stringify([tokenCA]))
      .run();

    return {
      level: "contributor", levelEmoji: "🥉", levelName: "Contributor",
      totalSubmissions: 1, currentStreak: 1, longestStreak: 1,
      bonusAnalyses: 1, patternLibraryAccess: true,
      airdropEligible: false, airdropMultiplier: 0,
      isNewContributor: true,
    };
  }

  const totalSubmissions = profile.total_submissions + 1;
  let currentStreak = profile.current_streak_days;
  const lastDate = profile.streak_last_date;

  if (lastDate === today) {
    // Already submitted today
  } else if (lastDate === yesterday) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }

  const longestStreak = Math.max(profile.longest_streak_days, currentStreak);
  const level = calculateLevel(currentStreak, totalSubmissions);
  const levelDef = CONTRIBUTOR_LEVELS[level];
  const wasLevelUp = profile.contributor_level !== level;

  await db
    .prepare(
      `UPDATE contributors SET
        total_submissions = ?, last_submission_at = ?,
        current_streak_days = ?, longest_streak_days = ?, streak_last_date = ?,
        contributor_level = ?, airdrop_eligible = ?, airdrop_multiplier = ?,
        daily_bonus_analyses = ?, pattern_library_access = ?, updated_at = ?
       WHERE hash = ?`)
    .bind(
      totalSubmissions, now, currentStreak, longestStreak, today,
      level, levelDef.airdropMultiplier > 0 ? 1 : 0, levelDef.airdropMultiplier,
      levelDef.bonusAnalyses, levelDef.patternAccess ? 1 : 0, now, contributorHash)
    .run();

  await db
    .prepare(
      `INSERT INTO contributor_daily_log (contributor_hash, date, submissions_count, tokens_analyzed)
       VALUES (?, ?, 1, ?)
       ON CONFLICT (contributor_hash, date)
       DO UPDATE SET submissions_count = submissions_count + 1`)
    .bind(contributorHash, today, JSON.stringify([tokenCA]))
    .run();

  return {
    level, levelEmoji: levelDef.emoji, levelName: levelDef.name,
    totalSubmissions, currentStreak, longestStreak,
    bonusAnalyses: levelDef.bonusAnalyses, patternLibraryAccess: levelDef.patternAccess,
    airdropEligible: levelDef.airdropMultiplier > 0, airdropMultiplier: levelDef.airdropMultiplier,
    isNewContributor: false, leveledUp: wasLevelUp ? level : undefined,
  };
}

export async function getContributorProfile(
  db: D1Database,
  contributorHash: string,
): Promise<ContributorProfile | null> {
  const row = await db.prepare("SELECT * FROM contributors WHERE hash = ?")
    .bind(contributorHash).first<ContributorRow>();
  if (!row) return null;
  const levelDef = CONTRIBUTOR_LEVELS[row.contributor_level as ContributorLevelId] ?? CONTRIBUTOR_LEVELS.none;
  return {
    level: row.contributor_level, levelEmoji: levelDef.emoji, levelName: levelDef.name,
    totalSubmissions: row.total_submissions, currentStreak: row.current_streak_days,
    longestStreak: row.longest_streak_days, bonusAnalyses: levelDef.bonusAnalyses,
    patternLibraryAccess: levelDef.patternAccess, airdropEligible: row.airdrop_eligible === 1,
    airdropMultiplier: row.airdrop_multiplier, isNewContributor: false,
  };
}

export async function getTopContributors(
  db: D1Database,
  limit = 50,
): Promise<ContributorLeaderboardEntry[]> {
  const rows = await db
    .prepare(
      `SELECT hash, total_submissions, current_streak_days, longest_streak_days,
              contributor_level, airdrop_multiplier, first_submission_at, last_submission_at
       FROM contributors WHERE total_submissions > 0
       ORDER BY airdrop_multiplier DESC, current_streak_days DESC, total_submissions DESC
       LIMIT ?`)
    .bind(limit).all<ContributorRow>();

  return (rows.results ?? []).map((row, index) => ({
    rank: index + 1, contributorId: row.hash,
    level: row.contributor_level,
    levelEmoji: CONTRIBUTOR_LEVELS[row.contributor_level as ContributorLevelId]?.emoji ?? "",
    totalSubmissions: row.total_submissions, currentStreak: row.current_streak_days,
    longestStreak: row.longest_streak_days, airdropMultiplier: row.airdrop_multiplier,
    memberSince: row.first_submission_at, lastActive: row.last_submission_at,
  }));
}
