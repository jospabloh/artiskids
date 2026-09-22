// Module 20, Layer 3 -- the reap job. Layer 1/2 (the client idle timer and
// the heartbeat) structurally can't close a session whose device died:
// battery drained, tab killed by the OS, laptop closed and never reopened
// never sends another heartbeat, so the row sits 'active'/'passive' forever
// with nothing client-side left running to log it out. Adapted from
// jospabloh/acacia-app-standard's shared/session/purgeStaleSessions.example.ts
// (a shape to adapt, not a file to copy byte-for-byte) to this app's
// AppSession entity and its own fail-closed cron guard.
import { createClientFromRequest } from "npm:@base44/sdk";
import { requireCron } from "./_internalGuard.ts";

// The portfolio default (shared/session/README.md): long enough that a
// legitimate multi-day-away laptop sleep doesn't get logged out from under
// someone, short enough that a dead session doesn't sit "active" for weeks.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export default async function (req: Request): Promise<Response> {
  const guardResponse = requireCron(req);
  if (guardResponse) return guardResponse; // fails closed: no secret -> 503, never runs

  const base44 = createClientFromRequest(req);
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  // Deliberately not filtered to status: 'active' -- a 'passive' (not
  // currently primary) device goes stale exactly the same way an 'active'
  // one does, and both need reaping.
  const candidates = await base44.asServiceRole.entities.AppSession.filter({
    status: { $ne: "revoked" },
    last_active_at: { $lt: cutoff },
  });

  let revoked = 0;
  for (const session of candidates) {
    await base44.asServiceRole.entities.AppSession.update(session.id, {
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: "system",
    });
    revoked++;
  }

  // sessionHeartbeat's own `if (session.status === "revoked") return 403`
  // check is what turns this into a forced re-auth the next time that
  // device's tab wakes up -- no separate client change needed.
  return Response.json({ ok: true, revoked, cutoff });
}
