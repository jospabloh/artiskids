// The ACACIA <-> Mission Control bridge for artiskids. One HMAC-signed,
// service-role channel; every action Mission Control's api/_lib/appBridge.js
// callBridge() can send is a case below. Adding a new action later is
// adding a case, not a new endpoint (Module 15).
//
// Scope note (2026-09, Phase 3 of the compliance rollout): implements every
// action Mission Control's own code actually calls today for a Base44 app
// with a Family/SupportTicket/AppSession model -- ping, licenses.list,
// license.set, usage.summary, usage.tenantCount, tickets.list,
// tickets.update, sessions.list, sessions.revoke, tenants.contacts.
// emails.sendFollowup was added 2026-10-07: Mission Control's new-tenant and
// new-ticket alerts to the platform owner go through it for EVERY app, and
// without it each ArtisKids alert failed with `unknown action` (3 of them
// between 2026-10-02 and 10-03 never reached the owner).
// Deliberately NOT implemented yet: license.deletePremiumData (premium-data
// downgrade path -- artiskids has no premium-only data model decided) and
// emails.status.
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { verifyAs } from "./_acaciaSign.ts";

// Entities license.set/usage.summary/usage.tenantCount may touch, by name.
// Mission Control passes the entity name as a string in the request body --
// never trust it as a live object key without a whitelist, or a
// misconfigured registry entry becomes an arbitrary-entity write.
const LICENSE_ENTITIES = new Set(["Family"]);
const USAGE_ENTITIES = new Set(["Drawing", "Child", "Comment", "Reaction"]);
const TICKET_ENTITY = "SupportTicket";
const SESSION_ENTITY = "AppSession";
// emails.sendFollowup sends mail to a customer: a replayed signed request would re-send it.
const WRITE_ACTIONS = new Set(["license.set", "tickets.update", "sessions.revoke", "emails.sendFollowup"]);

function badRequest(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export default async function (req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only", 405);

  const master = secrets.get("INGEST_HMAC_SECRET");
  const slug = secrets.get("ACACIA_APP_SLUG");
  if (!master || !slug) {
    // Fail closed: a missing secret must never read as "no auth configured,
    // let it through" (Module 16).
    return Response.json({ error: "bridge not configured" }, { status: 503 });
  }

  let body: { ts?: string | number; action?: string; params?: unknown; sig?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const { ts, action, params, sig } = body;
  if (!ts || !action || !sig) return badRequest("missing ts/action/sig");

  const verified = await verifyAs(master, slug, { ts, action, params, sig });
  if (!verified) return Response.json({ error: "bad signature" }, { status: 401 });

  const base44 = createClientFromRequest(req);
  const p = (params ?? {}) as Record<string, unknown>;

  // A signature stays valid for the 5-minute clock window (_acaciaSign.ts, a
  // byte-identical shared copy, so the check lives here). For actions that
  // write, the same signature is accepted once: a replayed license.set could
  // otherwise undo a newer one (security finding 2026-09-25). Reads stay
  // replayable -- repeating one changes nothing.
  if (WRITE_ACTIONS.has(action)) {
    try {
      const seen = await base44.asServiceRole.entities.BridgeNonce.filter({ sig });
      if (seen.length > 0) return Response.json({ error: "replayed request" }, { status: 409 });
      await base44.asServiceRole.entities.BridgeNonce.create({
        sig,
        expires_at: new Date(Number(ts) + 300_000).toISOString(),
      });
    } catch (e) {
      console.error("acaciaControl nonce check failed:", e);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
  }

  try {
    switch (action) {
      case "ping": {
        const start = Date.now();
        await base44.asServiceRole.entities.Family.list();
        return Response.json({ ok: true, app: slug, latencyMs: Date.now() - start });
      }

      case "licenses.list": {
        const entity = String(p.entity ?? "");
        if (!LICENSE_ENTITIES.has(entity)) return badRequest(`unsupported entity: ${entity}`);
        const records = await base44.asServiceRole.entities[entity].list();
        return Response.json({ records });
      }

      case "license.set": {
        const entity = String(p.entity ?? "");
        const id = String(p.id ?? "");
        const patch = p.patch as Record<string, unknown> | undefined;
        if (!LICENSE_ENTITIES.has(entity)) return badRequest(`unsupported entity: ${entity}`);
        if (!id || !patch) return badRequest("license.set needs id and patch");
        const updated = await base44.asServiceRole.entities[entity].update(id, patch);
        return Response.json({ ok: true, record: updated });
      }

      case "usage.summary": {
        const entities = Array.isArray(p.entities) ? (p.entities as string[]) : [];
        const counts: Record<string, number> = {};
        for (const name of entities) {
          if (!USAGE_ENTITIES.has(name)) continue; // silently skip unknown, not an error
          const rows = await base44.asServiceRole.entities[name].list();
          counts[name] = rows.length;
        }
        return Response.json({ counts });
      }

      case "usage.tenantCount": {
        const entity = String(p.entity ?? "");
        const tenantField = String(p.tenantField ?? "");
        const tenantValue = p.tenantValue;
        if (!USAGE_ENTITIES.has(entity)) return badRequest(`unsupported entity: ${entity}`);
        const rows = await base44.asServiceRole.entities[entity].list();
        const count = rows.filter((r: Record<string, unknown>) => r[tenantField] === tenantValue).length;
        return Response.json({ count });
      }

      case "tickets.list": {
        const records = await base44.asServiceRole.entities[TICKET_ENTITY].list();
        return Response.json({ records });
      }

      case "tickets.update": {
        const id = String(p.id ?? "");
        const patch = p.patch as Record<string, unknown> | undefined;
        if (!id || !patch) return badRequest("tickets.update needs id and patch");
        const updated = await base44.asServiceRole.entities[TICKET_ENTITY].update(id, patch);
        return Response.json({ ok: true, record: updated });
      }

      case "sessions.list": {
        const records = await base44.asServiceRole.entities[SESSION_ENTITY].list();
        return Response.json({ records });
      }

      case "sessions.revoke": {
        const ids = Array.isArray(p.ids) ? (p.ids as string[]) : [];
        const now = new Date().toISOString();
        const revoked: string[] = [];
        const cutEmails = new Set<string>();
        for (const id of ids) {
          const row = await base44.asServiceRole.entities[SESSION_ENTITY].get(id);
          await base44.asServiceRole.entities[SESSION_ENTITY].update(id, {
            status: "revoked",
            revoked_at: now,
            revoked_by: p.actorEmail ?? null,
          });
          revoked.push(id);
          if (row?.user_email) cutEmails.add(String(row.user_email));
        }
        // Marking the row alone never ended the login (Base44 can't revoke a
        // single token); the per-user cutoff does, in every router.
        for (const email of cutEmails) {
          const users = await base44.asServiceRole.entities.User.filter({ email });
          for (const u of users) {
            await base44.asServiceRole.entities.User.update(u.id, { sessions_valid_after: now });
          }
        }
        return Response.json({ ok: true, revoked });
      }

      case "emails.sendFollowup": {
        // Mission Control owns the recipient and the rendered content; the
        // bridge only sends it through the app's email integration.
        const to = String(p.to ?? "");
        const subject = String(p.subject ?? "");
        const html = String(p.html ?? "");
        if (!to || !subject || !html) return badRequest("params.to/subject/html required");
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html, from_name: "ACACIA" });
        // Core.SendEmail has no bcc: the platform owner gets a separate copy of
        // customer mail. `internal` = an ops notice MC already addresses to the
        // owner (new tenant, new ticket), where a copy would be a duplicate.
        const ownerEmail = secrets.get("PLATFORM_OWNER_EMAIL");
        if (ownerEmail && ownerEmail !== to && p.internal !== true) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: ownerEmail, subject: `[Copia → ${to}] ${subject}`, body: html, from_name: "ACACIA",
            });
          } catch { /* owner copy is best-effort */ }
        }
        return Response.json({ ok: true, sent_at: new Date().toISOString(), recipient: to });
      }

      case "tenants.contacts": {
        // Returns one contact per family: its family_admin's email. Mission
        // Control resolves which family a message is for on its own side
        // (see api/_lib/emailFollowup.js's resolveRecipients) -- this action
        // just hands back the whole list, keyed by family id, same as every
        // other portfolio app's tenants.contacts.
        //
        // UNVERIFIED ASSUMPTION, check before this ships: Base44's docs warn
        // the raw platform *management* API (POST/PUT .../entities/User)
        // reads/writes a disconnected fake store, not real accounts -- but
        // that warning is scoped to that management API, not the SDK client
        // used from inside a function. base44.asServiceRole.entities.User
        // below is the SDK path, which the docs' own "Get operation" example
        // treats as entity-name-agnostic. If this turns out wrong in testing
        // (e.g. it also returns a disconnected/empty set), family_admin
        // lookups need a different path -- possibly reading family_id/
        // family_role off the caller's own auth context instead, which only
        // works per-request, not from this service-role bridge context.
        const families = await base44.asServiceRole.entities.Family.list();
        const users = await base44.asServiceRole.entities.User.list();
        const contacts = families.map((f: Record<string, unknown>) => {
          const admin = users.find(
            (u: Record<string, unknown>) => u.family_id === f.id && u.family_role === "family_admin",
          );
          return { id: f.id, name: f.name, email: admin?.email ?? f.created_by_email ?? null };
        });
        return Response.json({ contacts });
      }

      default:
        return badRequest(`unknown action: ${action}`, 404);
    }
  } catch (e) {
    // The detail goes to the function log, never to the caller: an SDK or
    // platform message can name entities, fields or ids (scanner finding
    // 2026-09-25). Callers only need to know it wasn't their input.
    console.error("acaciaControl failed:", e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
