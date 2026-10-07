// Module 20, Layer 3 -- the reap job. Layer 1/2 (the client idle timer and
// the heartbeat) structurally can't close a session whose device died:
// battery drained, tab killed by the OS, laptop closed and never reopened
// never sends another heartbeat, so the row sits 'active'/'passive' forever
// with nothing client-side left running to log it out. Adapted from
// jospabloh/acacia-app-standard's shared/session/purgeStaleSessions.example.ts
// (a shape to adapt, not a file to copy byte-for-byte) to this app's
// AppSession entity.
//
// NO cron-secret guard, by the owner's decision (2026-10-07). It used to sit
// behind `Authorization: Bearer <CRON_SECRET>`, and that guard is why the job
// never reaped anything: Base44's scheduler invokes an automation with no
// user and no custom headers, so every hourly run got 401. Measured: a
// headerless POST to the deployed function answered
// `401 {"error":"unauthorized"}`, and sessions idle since 2026-09-22 were
// still 'passive' two weeks later.
//
// Being callable by anyone is safe here because the job takes no input and
// can only do what the session function already does on its own: revoke
// rows idle for more than STALE_AFTER_MS, which `session` refuses anyway
// (session/_sessionRules.ts). It returns no data. The worst a stranger can do
// is make that cleanup happen sooner than the next hour.
import { createClientFromRequest } from "npm:@base44/sdk";

// The portfolio default (shared/session/README.md), and the same figure as
// session/_sessionRules.ts: long enough that a legitimate multi-day-away
// laptop sleep doesn't get logged out from under someone, short enough that
// a dead session doesn't sit "active" for weeks.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export default async function (req: Request): Promise<Response> {
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

  // The count goes to the function log, not the response: an anonymous
  // caller has no business learning how many dead sessions exist.
  console.log(`purgeStaleSessions: revoked ${revoked} (cutoff ${cutoff})`);
  return Response.json({ ok: true });
}
