// Module 20's server half -- manageSession/sessionHeartbeat/trackActivity,
// the three actions shared/session/useSessionManager.js and
// useActivityTracker.js (copied unchanged in Phase 4) call by these exact
// names and param shapes. See jospabloh/acacia-app-standard's
// shared/session/README.md for the full three-layer spec this implements
// Layer 2 of; Layer 3 (the reap job) is base44/functions/purgeStaleSessions/.
import { createClientFromRequest } from "npm:@base44/sdk";

function badRequest(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

type Base44Client = ReturnType<typeof createClientFromRequest>;

async function getFreshCaller(base44: Base44Client, callerId: string) {
  return await base44.asServiceRole.entities.User.get(callerId);
}

export default async function (req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only", 405);

  const base44 = createClientFromRequest(req);
  let caller;
  try {
    caller = await base44.auth.me();
  } catch {
    return Response.json({ error: "not authenticated" }, { status: 401 });
  }
  if (!caller?.id) return Response.json({ error: "not authenticated" }, { status: 401 });

  let body: { action?: string; [key: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  // Flat body, not {action, params: {...}} -- shared/session/useSessionManager.js
  // and useActivityTracker.js (canonical, byte-identical, can't be edited here)
  // call base44.functions.invoke('session', { action, device_id, device_name })
  // with the rest of the params at the top level, so the server has to match.
  const { action, ...p } = body;

  try {
    switch (action) {
      case "manageSession": {
        const deviceId = String(p.device_id ?? "").trim();
        const deviceName = String(p.device_name ?? "").trim() || "Navegador";
        if (!deviceId) return badRequest("device_id is required");

        const fresh = await getFreshCaller(base44, caller.id);
        // useSessionManager fires on mount regardless of whether the caller
        // has joined a family yet -- AppSession.family_id is required, so
        // there's nothing to persist until they have. `session: null` (not
        // a 403/error) so the client's error handler doesn't mistake "no
        // family yet" for an idle timeout.
        if (!fresh.family_id) return Response.json({ ok: true, session: null });

        const now = new Date().toISOString();
        const existing = await base44.asServiceRole.entities.AppSession.filter({
          family_id: fresh.family_id,
          user_email: fresh.email,
          device_id: deviceId,
        });

        let session;
        if (existing[0]) {
          session = await base44.asServiceRole.entities.AppSession.update(existing[0].id, {
            status: "active",
            device: deviceName,
            last_active_at: now,
          });
        } else {
          session = await base44.asServiceRole.entities.AppSession.create({
            family_id: fresh.family_id,
            user_email: fresh.email,
            device_id: deviceId,
            device: deviceName,
            status: "active",
            started_at: now,
            last_active_at: now,
          });
        }

        // Demote every OTHER active session for this user to passive -- the
        // device list can show "also active on: iPhone, 3 min ago" because
        // exactly one row is ever 'active' at a time.
        const others = await base44.asServiceRole.entities.AppSession.filter({
          family_id: fresh.family_id,
          user_email: fresh.email,
          status: "active",
        });
        for (const other of others) {
          if (other.id === session.id) continue;
          await base44.asServiceRole.entities.AppSession.update(other.id, { status: "passive" });
        }

        return Response.json({ ok: true, session });
      }

      case "sessionHeartbeat": {
        const sessionId = String(p.session_id ?? "");
        if (!sessionId) return badRequest("session_id is required");

        const fresh = await getFreshCaller(base44, caller.id);
        const session = await base44.asServiceRole.entities.AppSession.get(sessionId);
        if (!fresh.family_id || session.family_id !== fresh.family_id || session.user_email !== fresh.email) {
          return Response.json({ error: "not your session" }, { status: 403 });
        }
        // This is the check that makes Layer 3 (the reap job) and a remote
        // force-logout actually take effect -- revoking a session server-side
        // does nothing until the next heartbeat reads it back.
        if (session.status === "revoked") {
          return Response.json({ error: "session revoked" }, { status: 403 });
        }

        await base44.asServiceRole.entities.AppSession.update(sessionId, {
          last_active_at: new Date().toISOString(),
        });
        return Response.json({ ok: true, status: session.status });
      }

      case "trackActivity": {
        // Usage/engagement signal, deliberately separate from the heartbeat
        // above -- throttled to once/hour client-side, and carries no
        // session_id (useActivityTracker.js doesn't have one to send). No
        // dedicated usage-event log exists for artiskids yet, so this bumps
        // the caller's current primary (active) session's last_active_at,
        // the same field the heartbeat touches, as the best available
        // "someone did something" signal until one does.
        const fresh = await getFreshCaller(base44, caller.id);
        if (!fresh.family_id) return Response.json({ ok: true });

        const sessions = await base44.asServiceRole.entities.AppSession.filter(
          { family_id: fresh.family_id, user_email: fresh.email, status: "active" },
          "-last_active_at",
          1,
        );
        if (sessions[0]) {
          await base44.asServiceRole.entities.AppSession.update(sessions[0].id, {
            last_active_at: new Date().toISOString(),
          });
        }
        return Response.json({ ok: true });
      }

      case "listSessions": {
        // The Account page's device list -- the caller's own sessions only,
        // never the rest of the family (a device belongs to a person, not
        // the tenant, even though AppSession.family_id is the RLS boundary).
        const fresh = await getFreshCaller(base44, caller.id);
        if (!fresh.family_id) return Response.json({ sessions: [] });
        const sessions = await base44.asServiceRole.entities.AppSession.filter(
          { family_id: fresh.family_id, user_email: fresh.email },
          "-last_active_at",
        );
        return Response.json({ sessions });
      }

      case "revokeSession": {
        const sessionId = String(p.session_id ?? "");
        if (!sessionId) return badRequest("session_id is required");
        const fresh = await getFreshCaller(base44, caller.id);
        const session = await base44.asServiceRole.entities.AppSession.get(sessionId);
        if (!fresh.family_id || session.family_id !== fresh.family_id || session.user_email !== fresh.email) {
          return Response.json({ error: "not your session" }, { status: 403 });
        }
        await base44.asServiceRole.entities.AppSession.update(sessionId, {
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: fresh.email,
        });
        return Response.json({ ok: true });
      }

      default:
        return badRequest(`unknown action: ${action}`, 404);
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
