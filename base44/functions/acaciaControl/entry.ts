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
// Deliberately NOT implemented yet: license.deletePremiumData (premium-data
// downgrade path -- artiskids has no premium-only data model decided),
// emails.sendFollowup / emails.status (no email-sending integration chosen
// for this app yet). Both are called only if Mission Control's own registry
// entry for artiskids (Phase 5) is configured to call them, which it won't
// be until they're built -- add the case here first, then wire the config.
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
        for (const id of ids) {
          await base44.asServiceRole.entities[SESSION_ENTITY].update(id, {
            status: "revoked",
            revoked_at: now,
            revoked_by: p.actorEmail ?? null,
          });
          revoked.push(id);
        }
        return Response.json({ ok: true, revoked });
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
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
