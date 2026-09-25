// Safe writes for the six tenant-scoped catalog/content entities
// (Drawing/Comment/Reaction/Child/Parent/Relative). RLS already enforces the
// family_id tenant boundary on direct entity access (Module 4), but none of
// these entities' family_id is write-locked yet (see CLAUDE.md's Phase 2 RLS
// design notes: locking it now would break the client's still-direct writes
// before Phase 4 replaces them with calls to this function). Until then, this
// router is the one place that both derives family_id server-side -- never
// trusting a client-supplied value -- and checks the permission registry
// before a write, the two things RLS alone can't do here (Module 3).
import { createClientFromRequest } from "npm:@base44/sdk";
import { tokenCutoff } from "./_tokenCutoff.ts";
import { defaultAllowed } from "./_permissions.generated.ts";
import { countBytesUpTo, quotaBytesFor } from "./_storageQuota.ts";

const CATALOG_ENTITIES = new Set(["Child", "Parent", "Relative"]);
const IMAGE_LINK_SECONDS = 3600;

function badRequest(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

type Base44Client = ReturnType<typeof createClientFromRequest>;

async function getFreshCaller(base44: Base44Client, callerId: string) {
  return await base44.asServiceRole.entities.User.get(callerId);
}

/**
 * Same precedence as the family router's canManageFamily, plus the
 * Family.billing_status gate that router deliberately skips: content writes
 * (uploading, commenting, reacting, editing the catalog) are exactly what
 * `view_only` exists to block, unlike leaving or deleting the family itself.
 * Platform owner bypasses all of it, same as everywhere else in the bridge.
 */
async function canWrite(
  base44: Base44Client,
  fresh: Record<string, unknown>,
  section: string,
  action: string,
): Promise<boolean> {
  if (fresh.role === "admin") return true;
  if (!fresh.family_id || !fresh.family_role) return false;

  const family = await base44.asServiceRole.entities.Family.get(fresh.family_id as string);
  if (family.billing_status === "view_only" || family.billing_status === "suspended") return false;

  const overrides = await base44.asServiceRole.entities.RolePermission.filter({
    family_id: fresh.family_id as string,
    role: fresh.family_role as string,
    permission_key: `${section}:${action}`,
  });
  if (overrides.length > 0) return Boolean(overrides[0].allowed);
  return defaultAllowed(section, action, fresh.family_role as string);
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

  // A token issued before the user's sessions_valid_after was revoked by
  // "cerrar sesión" (see _tokenCutoff.ts). Re-read, never trusted from the JWT.
  const cutoffUser = await base44.asServiceRole.entities.User.get(caller.id);
  const cut = tokenCutoff(req.headers.get("Authorization"), cutoffUser.sessions_valid_after);
  if (cut === "revoked") return Response.json({ error: "session revoked" }, { status: 401 });
  if (cut === "unknown") console.warn("content: sessions_valid_after set but the token has no iat; cutoff not enforced");

  let body: { action?: string; [key: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  // Flat body: { action, ...params } -- same convention as family/support,
  // and the shape shared/session/useSessionManager.js already dictates for
  // the session function (see the comment there).
  const { action, ...p } = body;

  try {
    const fresh = await getFreshCaller(base44, caller.id);
    if (!fresh.family_id) return Response.json({ error: "not in a family" }, { status: 403 });
    const familyId = fresh.family_id as string;

    switch (action) {
      case "createDrawing": {
        if (!(await canWrite(base44, fresh, "Dibujos", "upload"))) {
          return Response.json({ error: "not allowed to upload" }, { status: 403 });
        }
        const title = String(p.title ?? "").trim();
        const creatorName = String(p.creator_name ?? "").trim();
        // Private storage only. A public image_url is refused outright rather
        // than accepted as a fallback: a public file is readable by anyone who
        // has its link, with no login, and these are children's drawings.
        const imageFileUri = String(p.image_file_uri ?? "").trim();
        if (!title || !creatorName || !imageFileUri) {
          return badRequest("title, creator_name and image_file_uri are required");
        }

        // A file_uri that ever belonged to a Drawing -- live in any family, or
        // deleted (RetiredFile; the SDK can't delete the file itself) -- is
        // never accepted again. Otherwise an ex-member who kept another
        // family's URIs could attach them here and have imageUrls sign those
        // photos for them. A fresh upload always has a new URI, so this never
        // blocks a real one; an unattached upload's URI is known only to its
        // own uploader (security findings 2026-09-25).
        const [liveUse, retired] = await Promise.all([
          base44.asServiceRole.entities.Drawing.filter({ image_file_uri: imageFileUri }),
          base44.asServiceRole.entities.RetiredFile.filter({ file_uri: imageFileUri }),
        ]);
        if (liveUse.length > 0 || retired.length > 0) {
          return Response.json({ error: "ese archivo ya pertenece a otro dibujo" }, { status: 409 });
        }

        const family = await base44.asServiceRole.entities.Family.get(familyId);
        const used = Number(family.storage_used_bytes ?? 0);
        const quota = quotaBytesFor(family.billing_status as string | undefined);
        // The size is measured from the stored file itself. The client still
        // sends file_size_bytes, but it is ignored: a declared size let a
        // family upload far past its quota by claiming 1 byte per file.
        let fileSizeBytes: number;
        try {
          const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
            file_uri: imageFileUri,
            expires_in: 60,
          });
          const res = await fetch(signed_url, { signal: AbortSignal.timeout(20000) });
          if (!res.ok || !res.body) throw new Error(`status ${res.status}`);
          fileSizeBytes = await countBytesUpTo(res.body, Math.max(0, quota - used));
        } catch {
          return Response.json({ error: "no se pudo verificar el archivo subido" }, { status: 400 });
        }
        if (fileSizeBytes <= 0) return badRequest("el archivo subido está vacío");
        if (used + fileSizeBytes > quota) {
          return Response.json({ error: "storage quota exceeded" }, { status: 403 });
        }

        const drawing = await base44.asServiceRole.entities.Drawing.create({
          family_id: familyId,
          title,
          creator_name: creatorName,
          image_file_uri: imageFileUri,
          file_size_bytes: fileSizeBytes,
          description: p.description ? String(p.description) : undefined,
          drawn_date: p.drawn_date ? String(p.drawn_date) : undefined,
          album: p.album ? String(p.album) : undefined,
        });
        await base44.asServiceRole.entities.Family.update(familyId, {
          storage_used_bytes: used + fileSizeBytes,
        });
        return Response.json({ ok: true, drawing });
      }

      case "imageUrls": {
        // Short-lived signed links for private drawings, minted here rather
        // than in the browser so the family check below always runs: a
        // file_uri alone must never be enough to see a photo. Reading is not
        // gated on billing_status -- view_only families can still look.
        const ids = Array.isArray(p.ids) ? [...new Set((p.ids as unknown[]).map(String))].slice(0, 200) : [];
        const urls: Record<string, string> = {};
        await Promise.all(ids.map(async (id) => {
          const d = await base44.asServiceRole.entities.Drawing.get(id).catch(() => null);
          // Checked against the STORED row, never the request: another
          // family's id simply gets no link, same as an id that doesn't exist.
          if (!d || d.family_id !== familyId) return;
          if (d.image_file_uri) {
            const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
              file_uri: d.image_file_uri,
              expires_in: IMAGE_LINK_SECONDS,
            });
            urls[id] = signed_url;
          } else if (d.image_url) {
            urls[id] = d.image_url; // legacy public upload, see Drawing.jsonc
          }
        }));
        return Response.json({ urls, expires_in: IMAGE_LINK_SECONDS });
      }

      case "deleteDrawing": {
        if (!(await canWrite(base44, fresh, "Dibujos", "delete"))) {
          return Response.json({ error: "not allowed to delete" }, { status: 403 });
        }
        const id = String(p.id ?? "");
        if (!id) return badRequest("id is required");
        const drawing = await base44.asServiceRole.entities.Drawing.get(id);
        if (drawing.family_id !== familyId) {
          return Response.json({ error: "drawing is not in your family" }, { status: 403 });
        }
        // Retire the URI before the row goes: if this write fails, nothing is
        // deleted and the URI stays blocked through the live Drawing.
        if (drawing.image_file_uri) {
          await base44.asServiceRole.entities.RetiredFile.create({ file_uri: drawing.image_file_uri });
        }
        await base44.asServiceRole.entities.Comment.deleteMany({ drawing_id: id });
        await base44.asServiceRole.entities.Reaction.deleteMany({ drawing_id: id });
        await base44.asServiceRole.entities.Drawing.delete(id);

        const family = await base44.asServiceRole.entities.Family.get(familyId);
        const used = Number(family.storage_used_bytes ?? 0);
        const freed = Number(drawing.file_size_bytes ?? 0);
        await base44.asServiceRole.entities.Family.update(familyId, {
          storage_used_bytes: Math.max(0, used - freed),
        });
        return Response.json({ ok: true });
      }

      case "createComment": {
        if (!(await canWrite(base44, fresh, "Comentarios", "create"))) {
          return Response.json({ error: "not allowed to comment" }, { status: 403 });
        }
        const drawingId = String(p.drawing_id ?? "");
        const text = String(p.text ?? "").trim();
        const authorName = String(p.author_name ?? "").trim() || "Familiar";
        if (!drawingId || !text) return badRequest("drawing_id and text are required");
        // family_id is re-derived from the target drawing, never trusted from
        // the request body (Comment.jsonc's own tenant-boundary note).
        const drawing = await base44.asServiceRole.entities.Drawing.get(drawingId);
        if (drawing.family_id !== familyId) {
          return Response.json({ error: "drawing is not in your family" }, { status: 403 });
        }
        const comment = await base44.asServiceRole.entities.Comment.create({
          family_id: familyId,
          drawing_id: drawingId,
          author_name: authorName,
          text,
        });
        return Response.json({ ok: true, comment });
      }

      case "createReaction": {
        if (!(await canWrite(base44, fresh, "Reacciones", "create"))) {
          return Response.json({ error: "not allowed to react" }, { status: 403 });
        }
        const drawingId = String(p.drawing_id ?? "");
        const emoji = String(p.emoji ?? "").trim();
        const authorName = String(p.author_name ?? "").trim() || "Familiar";
        if (!drawingId || !emoji) return badRequest("drawing_id and emoji are required");
        const drawing = await base44.asServiceRole.entities.Drawing.get(drawingId);
        if (drawing.family_id !== familyId) {
          return Response.json({ error: "drawing is not in your family" }, { status: 403 });
        }
        const reaction = await base44.asServiceRole.entities.Reaction.create({
          family_id: familyId,
          drawing_id: drawingId,
          author_name: authorName,
          emoji,
        });
        return Response.json({ ok: true, reaction });
      }

      case "createCatalogEntry": {
        if (!(await canWrite(base44, fresh, "Catalogo", "manage"))) {
          return Response.json({ error: "not allowed to manage the catalog" }, { status: 403 });
        }
        const entity = String(p.entity ?? "");
        const data = (p.data ?? {}) as Record<string, unknown>;
        if (!CATALOG_ENTITIES.has(entity)) return badRequest(`unsupported entity: ${entity}`);
        if (!String(data.name ?? "").trim()) return badRequest("name is required");
        const record = await base44.asServiceRole.entities[entity].create({
          ...data,
          family_id: familyId,
        });
        return Response.json({ ok: true, record });
      }

      case "deleteCatalogEntry": {
        if (!(await canWrite(base44, fresh, "Catalogo", "manage"))) {
          return Response.json({ error: "not allowed to manage the catalog" }, { status: 403 });
        }
        const entity = String(p.entity ?? "");
        const id = String(p.id ?? "");
        if (!CATALOG_ENTITIES.has(entity)) return badRequest(`unsupported entity: ${entity}`);
        if (!id) return badRequest("id is required");
        const record = await base44.asServiceRole.entities[entity].get(id);
        if (record.family_id !== familyId) {
          return Response.json({ error: "record is not in your family" }, { status: 403 });
        }
        await base44.asServiceRole.entities[entity].delete(id);
        return Response.json({ ok: true });
      }

      default:
        return badRequest(`unknown action: ${action}`, 404);
    }
  } catch (e) {
    // The detail goes to the function log, never to the caller: an SDK or
    // platform message can name entities, fields or ids (scanner finding
    // 2026-09-25). Callers only need to know it wasn't their input.
    console.error("content failed:", e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
