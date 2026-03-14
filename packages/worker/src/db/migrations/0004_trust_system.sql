-- Trust Score system

-- Add trust_score to contributors
ALTER TABLE contributors ADD COLUMN trust_score REAL NOT NULL DEFAULT 50;

-- Add weight and dispute fields to submissions
ALTER TABLE submissions ADD COLUMN submission_weight REAL NOT NULL DEFAULT 1.0;
ALTER TABLE submissions ADD COLUMN is_disputed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN scoring_pattern_type TEXT;
ALTER TABLE submissions ADD COLUMN dispute_reason TEXT;

-- Community votes table
CREATE TABLE IF NOT EXISTS community_votes (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  token_ca TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('agree', 'disagree')),
  voter_trust_score REAL NOT NULL DEFAULT 50,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

CREATE INDEX IF NOT EXISTS idx_votes_submission ON community_votes(submission_id);
CREATE INDEX IF NOT EXISTS idx_votes_token ON community_votes(token_ca);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON community_votes(voter_hash);

-- Unique constraint: one vote per voter per submission
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique ON community_votes(submission_id, voter_hash);

-- Index for trust score on contributors
CREATE INDEX IF NOT EXISTS idx_contributors_trust ON contributors(trust_score DESC);
