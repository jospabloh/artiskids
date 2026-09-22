// Fail-closed guard for artiskids' own internal scheduled functions --
// distinct from the ACACIA<->Mission Control bridge's HMAC scheme
// (_acaciaSign.ts), because nothing outside this app calls these. Same
// discipline as Mission Control's requireCron.js, built the hard way after
// theirs shipped without it (see acacia-app-standard/STANDARD.md's module-16
// incident record, "A guard that never guarded" -- `if (secret && ...)`
// skips the check entirely when the secret is unset, and it was unset, and
// the endpoint ran anyway). A missing CRON_SECRET must mean 503, never a
// check that quietly passes.
import { secrets } from "base44:runtime";

export function requireCron(req: Request): Response | null {
  const secret = secrets.get("CRON_SECRET");
  if (!secret) {
    return Response.json({ error: "cron not configured" }, { status: 503 });
  }
  const provided = req.headers.get("authorization");
  if (provided !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
