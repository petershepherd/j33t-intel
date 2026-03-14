/**
 * Activity Feed — logs all events for the live ticker
 */

export type ActivityEventType = "submission" | "disputed" | "vote" | "level_up" | "streak";

export interface ActivityEvent {
  id: string;
  eventType: ActivityEventType;
  contributorHash: string;
  tokenCA?: string;
  details: string;
  trustChange: number;
  createdAt: number;
}

function generateActivityId(): string {
  return "act_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export async function logActivity(
  db: D1Database,
  eventType: ActivityEventType,
  contributorHash: string,
  details: string,
  trustChange: number = 0,
  tokenCA?: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO activity_log (id, event_type, contributor_hash, token_ca, details, trust_change, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(generateActivityId(), eventType, contributorHash, tokenCA || null, details, trustChange, Date.now())
      .run();

    // Keep only last 500 entries
    await db
      .prepare(
        `DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY created_at DESC LIMIT 500)`)
      .run();
  } catch(e) {
    console.error("Activity log error:", e);
  }
}

export async function getRecentActivity(
  db: D1Database,
  limit: number = 20,
  since?: number,
): Promise<ActivityEvent[]> {
  let query = "SELECT * FROM activity_log";
  const params: unknown[] = [];

  if (since) {
    query += " WHERE created_at > ?";
    params.push(since);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const rows = await db.prepare(query).bind(...params).all<{
    id: string;
    event_type: string;
    contributor_hash: string;
    token_ca: string | null;
    details: string;
    trust_change: number;
    created_at: number;
  }>();

  return (rows.results ?? []).map(r => ({
    id: r.id,
    eventType: r.event_type as ActivityEventType,
    contributorHash: r.contributor_hash,
    tokenCA: r.token_ca || undefined,
    details: r.details,
    trustChange: r.trust_change,
    createdAt: r.created_at,
  }));
}
