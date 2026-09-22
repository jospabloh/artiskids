// Module 8's real-time half: a ticket must reach Mission Control the moment
// it's written, not wait for the daily 08:00 UTC sync -- an app that relies
// on the sync alone leaves a customer who wrote at 09:00 waiting twenty-three
// hours before support even knows (acacia-app-standard's STANDARD.md).
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { signAs } from "./_acaciaSign.ts";

function badRequest(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Signs and pushes the ticket to Mission Control's ingest endpoint the
 * moment it's created. Best-effort and non-blocking, same as the family
 * router's Module 1 ping -- a failure here must never turn a successfully
 * created ticket into a failed response, since the ticket is already real
 * either way and the next daily sync is the backstop.
 *
 * KNOWN GAP, tracked for Phase 5: Mission Control's api/_lib/ticketControl.js
 * has no artiskids entry yet (checked directly, not assumed -- it lists
 * puntos/stockflow/flowfin/cateqhub/radar/liuma/ctrlhq/kitchops/rumbo and
 * stops there), so api/ingest/ticket.js currently 4xxs this call with "app
 * artiskids no soporta tickets" until that entry exists. That's exactly what
 * Phase 5 adds -- this call is written to work the moment it does, and is
 * harmless while it doesn't (swallowed below, same as a network failure).
 */
async function pushTicket(
  slug: string,
  ticket: { id: string; subject: string; status: string; created_date?: string; last_activity_at?: string; family_id: string },
): Promise<void> {
  try {
    const master = secrets.get("INGEST_HMAC_SECRET");
    if (!master || !slug) return;
    const url = secrets.get("ACACIA_MC_INGEST_URL") || "https://control.acaciaco.com.mx/api/ingest/ticket";
    const ts = Date.now();
    const action = "ticket.ingest";
    const params = { app: slug, record: ticket };
    const sig = await signAs(master, slug, ts, action, params);
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ts, action, params, sig }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Best-effort only -- see the doc comment above.
  }
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

  let body: { action?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const { action } = body;
  const p = body.params ?? {};

  try {
    switch (action) {
      case "createTicket": {
        const subject = String(p.subject ?? "").trim();
        const message = String(p.message ?? "").trim();
        if (!subject || !message) return badRequest("subject and message are required");

        const fresh = await getFreshCaller(base44, caller.id);
        // No family yet means nowhere to file SupportTicket.family_id
        // against (a required field) -- the portfolio's fallback for this
        // exact gap is always a direct human channel (WhatsApp/email), never
        // a dead end; Phase 4's UI surfaces that, this function doesn't need
        // its own copy of it.
        if (!fresh.family_id) return Response.json({ error: "not in a family" }, { status: 403 });

        // Any family member may open a ticket, regardless of role -- unlike
        // content writes, there's no registry entry gating this, and no
        // billing_status gate either: a suspended or view_only family is
        // exactly the situation someone might need to file a ticket about.
        const now = new Date().toISOString();
        const ticket = await base44.asServiceRole.entities.SupportTicket.create({
          family_id: fresh.family_id,
          subject,
          message,
          status: "open",
          created_by_email: fresh.email,
          last_activity_at: now,
        });

        const slug = secrets.get("ACACIA_APP_SLUG");
        if (slug) {
          await pushTicket(slug, {
            id: ticket.id,
            subject: ticket.subject,
            status: ticket.status,
            created_date: ticket.created_date,
            last_activity_at: ticket.last_activity_at,
            family_id: ticket.family_id,
          });
        }

        return Response.json({ ok: true, ticket });
      }

      default:
        return badRequest(`unknown action: ${action}`, 404);
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
