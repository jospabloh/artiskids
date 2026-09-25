// Family lifecycle -- the Module 18-retired account model's write path.
// User.family_id/family_role are RLS-write-locked to admin (see
// base44/entities/User.jsonc), so every state change to "which family am I
// in, and what role" goes through here, as service role, never a direct
// client write. Every action re-reads the caller's own User row fresh via
// asServiceRole before deciding anything -- the request's own JWT claims are
// a snapshot from login time and can't be trusted for a 409/403 check
// (Module 22).
import { createClientFromRequest } from "npm:@base44/sdk";
import { secrets } from "base44:runtime";
import { signAs } from "./_acaciaSign.ts";
import { defaultAllowed } from "./_permissions.generated.ts";

const FAMILY_ADMIN = "family_admin";
const MEMBER = "member";
const TRIAL_DAYS = 30;
const EXPORT_LINK_SECONDS = 24 * 60 * 60;

function badRequest(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

function generateJoinCode(): string {
  // No ambiguous glyphs (0/O, 1/I) -- this gets read off a phone screen and
  // typed by hand on someone else's.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

/** Fire-and-forget Module 1 new-tenant ping. Mission Control has no receiver
 *  for this yet (see CLAUDE.md) -- a 404 or a network failure must never
 *  surface to the caller of createFamily, so every failure mode here is
 *  swallowed after one short-timeout attempt. */
async function pingNewTenant(slug: string, familyId: string): Promise<void> {
  try {
    const master = secrets.get("INGEST_HMAC_SECRET");
    if (!master || !slug) return;
    // Fixed destination, not a secret: an overridable URL is a way to send
    // HMAC-signed tenant data somewhere else, and nothing ever set it.
    const url = "https://control.acaciaco.com.mx/api/ingest/tenant";
    const ts = Date.now();
    const action = "tenant.created";
    const params = { app: slug, tenant_id: familyId };
    const sig = await signAs(master, slug, ts, action, params);
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ts, action, params, sig }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort only -- see the doc comment above.
  }
}

type Base44Client = ReturnType<typeof createClientFromRequest>;

/** The caller's own User row, re-read as service role so family_id/
 *  family_role reflect the database, not the JWT the request walked in
 *  with. Every action starts here. */
async function getFreshCaller(base44: Base44Client, callerId: string) {
  return await base44.asServiceRole.entities.User.get(callerId);
}

async function countFamilyAdmins(
  base44: Base44Client,
  familyId: string,
  excludeUserId?: string,
): Promise<number> {
  const admins = await base44.asServiceRole.entities.User.filter({
    family_id: familyId,
    family_role: FAMILY_ADMIN,
  });
  return admins.filter((u: Record<string, unknown>) => u.id !== excludeUserId).length;
}

/**
 * Gates the two Familia registry keys this router checks (manage_members,
 * danger_zone): platform owner always wins, otherwise the registry default
 * decides. RolePermission overrides are deliberately NOT consulted here --
 * a row that could grant these keys is a row that could promote its writer
 * to family_admin or let them run deleteFamily, so the Familia section is
 * never delegable through data, only through the registry itself (security
 * finding 2026-09-24: a member could self-create such a row). Also
 * deliberately does NOT apply Family.billing_status -- unlike content
 * writes, a suspended or view_only family must still be able to leave or
 * delete itself; billing_status blocks login itself before Phase 4's routed
 * auth ever reaches these actions, so gating them again here would only ever
 * trap someone who got in some other way, never protect anything.
 */
function canManageFamily(
  fresh: Record<string, unknown>,
  key: "manage_members" | "danger_zone",
): boolean {
  if (fresh.role === "admin") return true;
  if (!fresh.family_id || !fresh.family_role) return false;
  return defaultAllowed("Familia", key, fresh.family_role as string);
}

/** Removes a departing member's own Comments/Reactions (their Drawings
 *  stay -- a child's drawing doesn't disappear because the parent who
 *  scanned it left, per CLAUDE.md's frozen Danger zone decision). */
async function cascadeDeparture(base44: Base44Client, familyId: string, userId: string): Promise<void> {
  await base44.asServiceRole.entities.Comment.deleteMany({ family_id: familyId, created_by_id: userId });
  await base44.asServiceRole.entities.Reaction.deleteMany({ family_id: familyId, created_by_id: userId });
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
  // Flat body: { action, ...params } -- same convention as content/support,
  // and the shape shared/session/useSessionManager.js already dictates for
  // the session function (see the comment there).
  const { action, ...p } = body;

  try {
    switch (action) {
      case "createFamily": {
        const name = String(p.name ?? "").trim();
        if (!name) return badRequest("name is required");

        const fresh = await getFreshCaller(base44, caller.id);
        if (fresh.family_id) return Response.json({ error: "already in a family" }, { status: 409 });

        const now = new Date();
        const trialEndAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const family = await base44.asServiceRole.entities.Family.create({
          name,
          billing_status: "trial",
          trial_end_at: trialEndAt.toISOString(),
          created_by_email: fresh.email,
          join_code: generateJoinCode(),
        });
        await base44.asServiceRole.entities.User.update(caller.id, {
          family_id: family.id,
          family_role: FAMILY_ADMIN,
          pending_family_id: null,
        });

        const slug = secrets.get("ACACIA_APP_SLUG");
        if (slug) await pingNewTenant(slug, family.id);

        return Response.json({ ok: true, family });
      }

      case "listMembers": {
        // Any member can see who else is in their own family -- needed for
        // the Account page's member list and role management, and scoped
        // the same way the RLS tenant-boundary rule would if User.read
        // weren't locked to "your own row only" by Base44's built-in default.
        const fresh = await getFreshCaller(base44, caller.id);
        if (!fresh.family_id) return Response.json({ error: "not in a family" }, { status: 403 });
        const members = await base44.asServiceRole.entities.User.filter({ family_id: fresh.family_id });
        const safe = members.map((m: Record<string, unknown>) => ({
          id: m.id,
          email: m.email,
          family_role: m.family_role,
        }));
        return Response.json({ members: safe });
      }

      case "redeemCode": {
        const joinCode = String(p.join_code ?? "").trim();
        if (!joinCode) return badRequest("join_code is required");

        const fresh = await getFreshCaller(base44, caller.id);
        if (fresh.family_id) return Response.json({ error: "already in a family" }, { status: 409 });

        const matches = await base44.asServiceRole.entities.Family.filter({ join_code: joinCode });
        const family = matches[0];
        if (!family) return Response.json({ error: "invalid join code" }, { status: 404 });

        // A code REQUESTS access; the family's admin grants it (Module 2).
        // Joining straight away meant anyone holding a forwarded code saw
        // every drawing in the family. A new code replaces an older request.
        await base44.asServiceRole.entities.User.update(caller.id, {
          pending_family_id: family.id,
        });
        return Response.json({ ok: true, pending: true, family_name: family.name });
      }

      case "joinRequestStatus": {
        const fresh = await getFreshCaller(base44, caller.id);
        if (fresh.family_id || !fresh.pending_family_id) return Response.json({ pending: null });
        const family = await base44.asServiceRole.entities.Family.get(fresh.pending_family_id).catch(() => null);
        if (!family) {
          // The family was deleted while the request waited.
          await base44.asServiceRole.entities.User.update(caller.id, { pending_family_id: null });
          return Response.json({ pending: null });
        }
        return Response.json({ pending: { family_name: family.name } });
      }

      case "cancelJoinRequest": {
        await base44.asServiceRole.entities.User.update(caller.id, { pending_family_id: null });
        return Response.json({ ok: true });
      }

      case "listJoinRequests": {
        const fresh = await getFreshCaller(base44, caller.id);
        if (!fresh.family_id) return Response.json({ error: "not in a family" }, { status: 403 });
        if (!canManageFamily(fresh, "manage_members")) {
          return Response.json({ error: "not allowed to manage members" }, { status: 403 });
        }
        const requesters = await base44.asServiceRole.entities.User.filter({ pending_family_id: fresh.family_id });
        const requests = requesters
          .filter((u: Record<string, unknown>) => !u.family_id)
          .map((u: Record<string, unknown>) => ({ id: u.id, email: u.email }));
        return Response.json({ requests });
      }

      case "approveJoinRequest":
      case "rejectJoinRequest": {
        const targetUserId = String(p.target_user_id ?? "");
        if (!targetUserId) return badRequest("target_user_id is required");

        const fresh = await getFreshCaller(base44, caller.id);
        if (!fresh.family_id) return Response.json({ error: "not in a family" }, { status: 403 });
        if (!canManageFamily(fresh, "manage_members")) {
          return Response.json({ error: "not allowed to manage members" }, { status: 403 });
        }
        // Checked against the requester's STORED row, never the request body:
        // an admin can only answer requests made to their own family.
        const target = await base44.asServiceRole.entities.User.get(targetUserId).catch(() => null);
        if (!target || target.pending_family_id !== fresh.family_id) {
          return Response.json({ error: "no pending request for your family" }, { status: 404 });
        }

        if (action === "rejectJoinRequest") {
          await base44.asServiceRole.entities.User.update(targetUserId, { pending_family_id: null });
          return Response.json({ ok: true });
        }
        if (target.family_id) {
          // Joined or created another family in the meantime.
          await base44.asServiceRole.entities.User.update(targetUserId, { pending_family_id: null });
          return Response.json({ error: "already in a family" }, { status: 409 });
        }
        await base44.asServiceRole.entities.User.update(targetUserId, {
          family_id: fresh.family_id,
          family_role: MEMBER,
          pending_family_id: null,
        });
        return Response.json({ ok: true });
      }

      case "setMemberRole":
      case "delegateAdmin": {
        // delegateAdmin is setMemberRole pinned to family_admin -- kept as a
        // separate action name because the danger-zone UI calls it as a
        // distinct, single-purpose step ("delegate someone before you can
        // delete your own account"), not a role-picker.
        const targetUserId = String(p.target_user_id ?? "");
        const newRole = action === "delegateAdmin" ? FAMILY_ADMIN : String(p.new_role ?? "");
        if (!targetUserId) return badRequest("target_user_id is required");
        if (newRole !== FAMILY_ADMIN && newRole !== MEMBER) return badRequest("invalid new_role");

        const fresh = await getFreshCaller(base44, caller.id);
        if (!canManageFamily(fresh, "manage_members")) {
          return Response.json({ error: "not allowed to manage members" }, { status: 403 });
        }
        const target = await base44.asServiceRole.entities.User.get(targetUserId);
        if (target.family_id !== fresh.family_id) {
          return Response.json({ error: "target is not in your family" }, { status: 403 });
        }

        if (target.family_role === FAMILY_ADMIN && newRole === MEMBER) {
          const remaining = await countFamilyAdmins(base44, fresh.family_id, targetUserId);
          if (remaining === 0) {
            return Response.json({ error: "cannot leave the family with zero admins" }, { status: 409 });
          }
        }

        await base44.asServiceRole.entities.User.update(targetUserId, { family_role: newRole });
        return Response.json({ ok: true });
      }

      case "removeMember": {
        // A family_admin evicting someone else. Revokes membership (clears
        // family_id/family_role so the account is free to join or create a
        // different family) but never deletes the account itself -- that is
        // deleteMyAccount's call to make, not another member's.
        const targetUserId = String(p.target_user_id ?? "");
        if (!targetUserId) return badRequest("target_user_id is required");
        if (targetUserId === caller.id) {
          return badRequest("use deleteMyAccount to remove yourself");
        }

        const fresh = await getFreshCaller(base44, caller.id);
        if (!canManageFamily(fresh, "manage_members")) {
          return Response.json({ error: "not allowed to manage members" }, { status: 403 });
        }
        const target = await base44.asServiceRole.entities.User.get(targetUserId);
        if (target.family_id !== fresh.family_id) {
          return Response.json({ error: "target is not in your family" }, { status: 403 });
        }
        if (target.family_role === FAMILY_ADMIN) {
          const remaining = await countFamilyAdmins(base44, fresh.family_id, targetUserId);
          if (remaining === 0) {
            return Response.json({ error: "cannot remove the family's only admin" }, { status: 409 });
          }
        }

        await cascadeDeparture(base44, fresh.family_id, targetUserId);
        // UNVERIFIED ASSUMPTION, check at deploy time: family_id/family_role
        // aren't in User.jsonc's `required`, so this assumes an optional
        // string field accepts an explicit null on update the same way it
        // accepts being absent. If Base44 instead rejects null for a
        // string-typed field, this needs a sentinel value instead (or a
        // dedicated "unset" API) -- worth a manual test against the live
        // app before Phase 4's UI starts calling this action.
        await base44.asServiceRole.entities.User.update(targetUserId, {
          family_id: null,
          family_role: null,
        });
        return Response.json({ ok: true });
      }

      case "deleteMyAccount": {
        const fresh = await getFreshCaller(base44, caller.id);
        const ownerEmail = secrets.get("PLATFORM_OWNER_EMAIL");
        if (ownerEmail && fresh.email === ownerEmail) {
          return Response.json({ error: "the platform owner account can't be deleted here" }, { status: 403 });
        }
        if (fresh.family_id) {
          if (fresh.family_role === FAMILY_ADMIN) {
            const remaining = await countFamilyAdmins(base44, fresh.family_id, caller.id);
            if (remaining === 0) {
              return Response.json(
                { error: "delegate another family_admin before deleting your account" },
                { status: 409 },
              );
            }
          }
          await cascadeDeparture(base44, fresh.family_id, caller.id);
        }
        await base44.asServiceRole.entities.User.delete(caller.id);
        return Response.json({ ok: true });
      }

      case "deleteFamily": {
        const fresh = await getFreshCaller(base44, caller.id);
        // deleteFamily always targets the caller's own family -- a platform
        // owner's canManageFamily bypass is meaningless here without one, so
        // this checks family_id itself rather than folding it into the
        // helper the way manage_members does.
        if (!fresh.family_id) return Response.json({ error: "not in a family" }, { status: 403 });
        if (!canManageFamily(fresh, "danger_zone")) {
          return Response.json({ error: "not allowed to delete this family" }, { status: 403 });
        }
        const familyId = fresh.family_id;

        // The image files are NOT removed here: @base44/sdk 0.8.49's Core
        // integrations have no delete-file method at all (re-checked
        // 2026-09-23). For a private upload that is a storage cost, not a
        // leak -- a file_uri only becomes viewable through content's
        // imageUrls, which signs only for a Drawing row that still exists and
        // belongs to the caller's family, and that row is deleted just below.
        // A LEGACY public upload (image_url) stays reachable at its old link;
        // deleting the row cannot take that back.
        // Their private URIs stay signable, though, so each one is retired
        // first -- content's createDrawing refuses a retired URI, which is
        // what stops an ex-member re-attaching these photos elsewhere.
        const doomed = await base44.asServiceRole.entities.Drawing.filter({ family_id: familyId });
        const uris = doomed
          .map((d: Record<string, unknown>) => d.image_file_uri)
          .filter((u: unknown): u is string => typeof u === "string" && u.length > 0);
        if (uris.length > 0) {
          await base44.asServiceRole.entities.RetiredFile.bulkCreate(uris.map((file_uri: string) => ({ file_uri })));
        }
        await base44.asServiceRole.entities.Drawing.deleteMany({ family_id: familyId });
        await base44.asServiceRole.entities.Comment.deleteMany({ family_id: familyId });
        await base44.asServiceRole.entities.Reaction.deleteMany({ family_id: familyId });
        await base44.asServiceRole.entities.Child.deleteMany({ family_id: familyId });
        await base44.asServiceRole.entities.Parent.deleteMany({ family_id: familyId });
        await base44.asServiceRole.entities.Relative.deleteMany({ family_id: familyId });

        // Same null-on-optional-string-field assumption as removeMember above.
        const members = await base44.asServiceRole.entities.User.filter({ family_id: familyId });
        for (const member of members) {
          await base44.asServiceRole.entities.User.update(member.id, {
            family_id: null,
            family_role: null,
          });
        }

        const requesters = await base44.asServiceRole.entities.User.filter({ pending_family_id: familyId });
        for (const requester of requesters) {
          await base44.asServiceRole.entities.User.update(requester.id, { pending_family_id: null });
        }

        await base44.asServiceRole.entities.Family.delete(familyId);
        return Response.json({ ok: true });
      }

      case "exportData": {
        // Caller-scoped client, not service role: RLS's own tenant-boundary
        // rule on each of these entities is what proves this only ever
        // returns the caller's own family, the same guarantee every other
        // read in the app relies on -- exportData doesn't get a bypass.
        const fresh = await getFreshCaller(base44, caller.id);
        if (!fresh.family_id) return Response.json({ error: "not in a family" }, { status: 403 });

        const [family, children, parents, relatives, drawings, comments, reactions] = await Promise.all([
          base44.entities.Family.get(fresh.family_id),
          base44.entities.Child.filter({ family_id: fresh.family_id }),
          base44.entities.Parent.filter({ family_id: fresh.family_id }),
          base44.entities.Relative.filter({ family_id: fresh.family_id }),
          base44.entities.Drawing.filter({ family_id: fresh.family_id }),
          base44.entities.Comment.filter({ family_id: fresh.family_id }),
          base44.entities.Reaction.filter({ family_id: fresh.family_id }),
        ]);

        // A private file_uri means nothing outside the app, so each drawing
        // carries a download link instead. Signed for a day: long enough to
        // fetch the export, short enough that a forwarded file goes stale.
        const exportedDrawings = await Promise.all(drawings.map(async (d: Record<string, unknown>) => {
          // The raw file_uri is left out: it outlives the family membership
          // (the file itself can't be deleted), so it must not travel.
          const { image_file_uri, ...rest } = d;
          if (!image_file_uri) return rest;
          const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
            file_uri: image_file_uri as string,
            expires_in: EXPORT_LINK_SECONDS,
          });
          return { ...rest, image_download_url: signed_url };
        }));

        return Response.json({
          exported_at: new Date().toISOString(),
          image_links_expire_in_seconds: EXPORT_LINK_SECONDS,
          family: { name: family.name, billing_status: family.billing_status },
          children,
          parents,
          relatives,
          drawings: exportedDrawings,
          comments,
          reactions,
        });
      }

      default:
        return badRequest(`unknown action: ${action}`, 404);
    }
  } catch (e) {
    // The detail goes to the function log, never to the caller: an SDK or
    // platform message can name entities, fields or ids (scanner finding
    // 2026-09-25). Callers only need to know it wasn't their input.
    console.error("family failed:", e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
