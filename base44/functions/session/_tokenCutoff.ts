// Per-user session cutoff (security finding 2026-09-25). IDENTICAL COPY in
// content/, family/, session/ and support/ -- each function directory deploys
// on its own, so each carries the file; base44/functions/tokenCutoff.test.ts
// fails if the copies drift. No imports, so `deno test` loads it anywhere.
//
// Base44 can't revoke one login token, so "cerrar sesión" used to be UI only:
// the token kept working against every router, and a client holding it just
// registered as a new device. User.sessions_valid_after closes that: every
// router refuses a token issued (JWT `iat`) before it.

/** The JWT's `iat` in ms, or null if the header isn't a readable JWT. */
export function tokenIssuedAtMs(authHeader: string | null): number | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.iat === "number" ? payload.iat * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * "ok": no cutoff set, or the token is newer than it.
 * "revoked": the token was issued before the cutoff -- refuse it.
 * "unknown": a cutoff is set but the token has no readable `iat`. Allowed
 *   (refusing would lock the user out for good, since a fresh login would
 *   carry no `iat` either) and logged by the caller, because it means the
 *   cutoff is not being enforced.
 */
export function tokenCutoff(
  authHeader: string | null,
  sessionsValidAfter: unknown,
): "ok" | "revoked" | "unknown" {
  if (typeof sessionsValidAfter !== "string" || !sessionsValidAfter) return "ok";
  const cutoff = Date.parse(sessionsValidAfter);
  if (!Number.isFinite(cutoff)) return "ok";
  const iat = tokenIssuedAtMs(authHeader);
  if (iat === null) return "unknown";
  return iat < cutoff ? "revoked" : "ok";
}
