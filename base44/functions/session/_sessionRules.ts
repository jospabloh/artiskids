// The session-death rule, kept import-free so base44/functions/sessionRules.test.ts
// can load it without the Base44 runtime. purgeStaleSessions uses the same
// 48h figure; if one changes, change both.
export const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

// All optional: the SDK types filter()/get() results loosely (Pick<any, …>).
export type SessionRow = { id?: string; status?: string; last_active_at?: string; device_id?: string };

export function isStale(session: SessionRow, now = Date.now()): boolean {
  const last = Date.parse(session.last_active_at ?? "");
  return Number.isFinite(last) && now - last > STALE_AFTER_MS;
}

// Dead = must be refused, never revived: revoked (by the user, another
// device, or the reap job) or silent for longer than the reap threshold.
export function isDead(session: SessionRow, now = Date.now()): boolean {
  return session.status === "revoked" || isStale(session, now);
}

// The device_id a dead row is rewritten to once its device has been told.
// Unique per row, and never equal to a real per-browser UUID, so that
// browser's next manageSession finds nothing and starts a fresh session.
export function retiredDeviceId(session: SessionRow): string {
  return `retired:${session.id}:${session.device_id ?? ""}`;
}
