import { logActivity } from "./activity-feed.js";
/**
 * Trust Score System
 *
 * Every contributor starts at 50. Accurate submissions increase it,
 * inaccurate ones decrease it. Trust score determines submission weight.
 *
 * Trust Score → Submission Weight:
 *   80-100: 1.5x (trusted)
 *   50-79:  1.0x (normal)
 *   25-49:  0.5x (reduced)
 *   0-24:   0.1x (practically ignored)
 *
 * Score changes:
 *   Scoring agrees with user:      +2
 *   Scoring disagrees with user:   -5
 *   Community confirms:            +3
 *   Community rejects:             -3
 */

export function getSubmissionWeight(trustScore: number): number {
  if (trustScore >= 80) return 1.5;
  if (trustScore >= 50) return 1.0;
  if (trustScore >= 25) return 0.5;
  return 0.1;
}

export function clampTrust(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * Determine if the scoring engine agrees with the user's pattern classification.
 * Returns the scoring engine's own pattern classification.
 */
export function scoringPatternType(
  potentialScore: number,
  riskScore: number,
): "positive" | "negative" | "unknown" {
  if (potentialScore > 60 && riskScore < 40) return "positive";
  if (riskScore > 60) return "negative";
  return "unknown";
}

/**
 * Check if the user's classification conflicts with the scoring engine.
 * Returns null if no conflict, or a dispute reason if there is one.
 */
export function checkDispute(
  userPattern: string,
  potentialScore: number,
  riskScore: number,
): { disputed: boolean; scoringPattern: string; reason: string | null } {
  const scoring = scoringPatternType(potentialScore, riskScore);

  // Direct contradiction: user says positive but scoring says negative (or vice versa)
  if (userPattern === "positive" && scoring === "negative") {
    return {
      disputed: true,
      scoringPattern: scoring,
      reason: `User classified as POSITIVE but scoring shows high risk (${riskScore}/100)`,
    };
  }

  if (userPattern === "negative" && scoring === "positive") {
    return {
      disputed: true,
      scoringPattern: scoring,
      reason: `User classified as NEGATIVE but scoring shows high potential (${potentialScore}/100) and low risk (${riskScore}/100)`,
    };
  }

  // No direct contradiction — scoring agrees or is uncertain
  return {
    disputed: false,
    scoringPattern: scoring,
    reason: null,
  };
}

/**
 * Update a contributor's trust score after a submission.
 */
export async function updateTrustAfterSubmission(
  db: D1Database,
  contributorHash: string,
  agreed: boolean,
): Promise<number> {
  const change = agreed ? 2 : -5;

  const row = await db
    .prepare("SELECT trust_score FROM contributors WHERE hash = ?")
    .bind(contributorHash)
    .first<{ trust_score: number }>();

  const currentTrust = row?.trust_score ?? 50;
  const newTrust = clampTrust(currentTrust + change);

  await db
    .prepare("UPDATE contributors SET trust_score = ?, updated_at = ? WHERE hash = ?")
    .bind(newTrust, Date.now(), contributorHash)
    .run();

  return newTrust;
}

/**
 * Update trust scores after a community vote.
 */
export async function updateTrustAfterVote(
  db: D1Database,
  submissionContributorHash: string,
  voteIsAgree: boolean,
): Promise<number> {
  const change = voteIsAgree ? 3 : -3;

  const row = await db
    .prepare("SELECT trust_score FROM contributors WHERE hash = ?")
    .bind(submissionContributorHash)
    .first<{ trust_score: number }>();

  const currentTrust = row?.trust_score ?? 50;
  const newTrust = clampTrust(currentTrust + change);

  await db
    .prepare("UPDATE contributors SET trust_score = ?, updated_at = ? WHERE hash = ?")
    .bind(newTrust, Date.now(), submissionContributorHash)
    .run();

  return newTrust;
}

/**
 * Check if a contributor is temporarily blocked (trust < 10 and recent disputed submissions).
 */
export async function isContributorBlocked(
  db: D1Database,
  contributorHash: string,
): Promise<{ blocked: boolean; reason?: string }> {
  const row = await db
    .prepare("SELECT trust_score FROM contributors WHERE hash = ?")
    .bind(contributorHash)
    .first<{ trust_score: number }>();

  if (!row) return { blocked: false };

  if (row.trust_score < 10) {
    // Check if they have recent disputed submissions
    const oneDayAgo = Date.now() - 86_400_000;
    const disputed = await db
      .prepare(
        "SELECT COUNT(*) as cnt FROM submissions WHERE contributor_hash = ? AND is_disputed = 1 AND created_at > ?")
      .bind(contributorHash, oneDayAgo)
      .first<{ cnt: number }>();

    if (disputed && disputed.cnt >= 3) {
      return {
        blocked: true,
        reason: "Too many disputed submissions. Trust score too low. Try again in 24 hours.",
      };
    }
  }

  return { blocked: false };
}

/**
 * Get disputed submissions for community review.
 */
export async function getDisputedSubmissions(
  db: D1Database,
  limit = 10,
): Promise<DisputedSubmission[]> {
  const rows = await db
    .prepare(
      `SELECT s.id, s.token_ca, s.pattern_type, s.scoring_pattern_type,
              s.potential_score, s.rugpull_risk_score, s.dispute_reason,
              s.created_at, s.contributor_hash,
              (SELECT COUNT(*) FROM community_votes WHERE submission_id = s.id AND vote = 'agree') as agree_count,
              (SELECT COUNT(*) FROM community_votes WHERE submission_id = s.id AND vote = 'disagree') as disagree_count
       FROM submissions s
       WHERE s.is_disputed = 1
       ORDER BY s.created_at DESC
       LIMIT ?`)
    .bind(limit)
    .all<{
      id: string;
      token_ca: string;
      pattern_type: string;
      scoring_pattern_type: string;
      potential_score: number;
      rugpull_risk_score: number;
      dispute_reason: string;
      created_at: number;
      contributor_hash: string;
      agree_count: number;
      disagree_count: number;
    }>();

  return (rows.results ?? []).map((r) => ({
    id: r.id,
    tokenCA: r.token_ca,
    userPattern: r.pattern_type,
    scoringPattern: r.scoring_pattern_type,
    potentialScore: r.potential_score,
    riskScore: r.rugpull_risk_score,
    disputeReason: r.dispute_reason,
    createdAt: r.created_at,
    agreeVotes: r.agree_count,
    disagreeVotes: r.disagree_count,
  }));
}

/**
 * Cast a community vote on a disputed submission.
 */
export async function castVote(
  db: D1Database,
  submissionId: string,
  voterHash: string,
  vote: "agree" | "disagree",
): Promise<{ success: boolean; error?: string }> {
  // Check voter trust score
  const voter = await db
    .prepare("SELECT trust_score FROM contributors WHERE hash = ?")
    .bind(voterHash)
    .first<{ trust_score: number }>();

  if (!voter || voter.trust_score < 25) {
    return { success: false, error: "Your trust score is too low to vote" };
  }

  // Get submission info
  const submission = await db
    .prepare("SELECT contributor_hash, is_disputed FROM submissions WHERE id = ?")
    .bind(submissionId)
    .first<{ contributor_hash: string; is_disputed: number }>();

  if (!submission) return { success: false, error: "Submission not found" };
  if (!submission.is_disputed) return { success: false, error: "Submission is not disputed" };
  if (submission.contributor_hash === voterHash) return { success: false, error: "Cannot vote on your own submission" };

  // Insert vote
  const voteId = `vote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await db
      .prepare(
        `INSERT INTO community_votes (id, submission_id, token_ca, voter_hash, vote, voter_trust_score, created_at)
         SELECT ?, ?, token_ca, ?, ?, ?, ? FROM submissions WHERE id = ?`)
      .bind(voteId, submissionId, voterHash, vote, voter.trust_score, Date.now(), submissionId)
      .run();
  } catch {
    return { success: false, error: "You already voted on this submission" };
  }

  // Update submitter's trust based on vote
  await updateTrustAfterVote(db, submission.contributor_hash, vote === "agree");

  // Check if enough votes to resolve the dispute
  const votes = await db
    .prepare(
      `SELECT vote, COUNT(*) as cnt FROM community_votes WHERE submission_id = ? GROUP BY vote`)
    .bind(submissionId)
    .all<{ vote: string; cnt: number }>();

  const agreeCount = votes.results?.find((v) => v.vote === "agree")?.cnt ?? 0;
  const disagreeCount = votes.results?.find((v) => v.vote === "disagree")?.cnt ?? 0;

  // Resolve if 5+ total votes with clear majority (>60%)
  const totalVotes = agreeCount + disagreeCount;
  if (totalVotes >= 5) {
    if (agreeCount / totalVotes > 0.6) {
      // Community agrees with user → keep user's pattern, boost trust
      await db
        .prepare("UPDATE submissions SET is_disputed = 0 WHERE id = ?")
        .bind(submissionId)
        .run();
      await updateTrustAfterVote(db, submission.contributor_hash, true);
    } else if (disagreeCount / totalVotes > 0.6) {
      // Community disagrees → override to scoring's pattern, penalize trust
      const scoringPattern = await db
        .prepare("SELECT scoring_pattern_type FROM submissions WHERE id = ?")
        .bind(submissionId)
        .first<{ scoring_pattern_type: string }>();

      if (scoringPattern?.scoring_pattern_type) {
        await db
          .prepare("UPDATE submissions SET is_disputed = 0, pattern_type = ? WHERE id = ?")
          .bind(scoringPattern.scoring_pattern_type, submissionId)
          .run();
      }
      await updateTrustAfterVote(db, submission.contributor_hash, false);
    }
  }

  // Log vote activity
  try {
    await logActivity(db, "vote", voterHash, (vote === "agree" ? "Agreed" : "Disagreed") + " with disputed submission", 0);
  } catch(e3) {}

  return { success: true };
}

export interface DisputedSubmission {
  id: string;
  tokenCA: string;
  userPattern: string;
  scoringPattern: string;
  potentialScore: number;
  riskScore: number;
  disputeReason: string;
  createdAt: number;
  agreeVotes: number;
  disagreeVotes: number;
}
