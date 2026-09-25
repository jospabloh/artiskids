// Lives at the functions ROOT, like acaciaSign.test.ts: every directory under
// base44/functions/ is a deployed endpoint and a test file is not one.
//
// What this protects: "cerrar sesión" actually ending a login. If
// tokenCutoff ever answered "ok" for a token older than the cutoff, a revoked
// device (or a stolen token) would keep full access -- the exact gap it
// closed. And the four router copies must stay identical, or one router
// would enforce a different rule than the others.
import { assertEquals } from "jsr:@std/assert@1";
import { tokenCutoff, tokenIssuedAtMs } from "./session/_tokenCutoff.ts";

function jwt(payload: Record<string, unknown>): string {
  const b64u = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `Bearer ${b64u({ alg: "HS256", typ: "JWT" })}.${b64u(payload)}.sig`;
}

const CUTOFF = "2026-09-25T12:00:00.000Z";
const cutoffSec = Date.parse(CUTOFF) / 1000;

Deno.test("a token issued before the cutoff is revoked", () => {
  assertEquals(tokenCutoff(jwt({ iat: cutoffSec - 60 }), CUTOFF), "revoked");
});

Deno.test("a token from a fresh login after the cutoff works", () => {
  assertEquals(tokenCutoff(jwt({ iat: cutoffSec + 5 }), CUTOFF), "ok");
});

Deno.test("no cutoff set means every token works (the default for every user)", () => {
  assertEquals(tokenCutoff(jwt({ iat: 1 }), undefined), "ok");
  assertEquals(tokenCutoff(jwt({ iat: 1 }), null), "ok");
});

Deno.test("a cutoff with no readable iat is reported, not silently passed or locked", () => {
  assertEquals(tokenCutoff(jwt({ sub: "x" }), CUTOFF), "unknown");
  assertEquals(tokenCutoff("Bearer not-a-jwt", CUTOFF), "unknown");
  assertEquals(tokenCutoff(null, CUTOFF), "unknown");
});

Deno.test("iat is read from a base64url payload", () => {
  assertEquals(tokenIssuedAtMs(jwt({ iat: 1700000000 })), 1700000000_000);
});

Deno.test("the four router copies are identical", async () => {
  const dirs = ["content", "family", "session", "support"];
  const texts = await Promise.all(dirs.map((d) => Deno.readTextFile(new URL(`./${d}/_tokenCutoff.ts`, import.meta.url))));
  for (const t of texts) assertEquals(t, texts[0]);
});
