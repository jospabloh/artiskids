// Functions ROOT test (a file under a function directory would ship as an
// endpoint). No imports from jsr/deno.land: they are blocked in the sandbox.
import { ASSIGNABLE_ROLES, resolveApprovedRole } from "./family/_assignableRoles.ts";

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${String(b)}, got ${String(a)}`);
}

Deno.test("approval role: omitted defaults to member", () => {
  eq(resolveApprovedRole(undefined), "member", "undefined");
  eq(resolveApprovedRole(""), "member", "empty");
});

Deno.test("approval role: whitelisted roles pass", () => {
  eq(resolveApprovedRole("family_admin"), "family_admin", "admin");
  eq(resolveApprovedRole("member"), "member", "member");
});

Deno.test("approval role: platform and unknown roles are rejected", () => {
  for (const r of ["admin", "owner", "user", "Family_Admin", "member ", 1, {}]) {
    eq(resolveApprovedRole(r), null, `reject ${JSON.stringify(r)}`);
  }
});

Deno.test("whitelist never contains a platform role", () => {
  for (const r of ASSIGNABLE_ROLES) if (r === ("admin" as string)) throw new Error("platform role in whitelist");
});

Deno.test("whitelist matches src/lib/rbac.js FAMILY_ROLES", async () => {
  const src = await Deno.readTextFile(new URL("../../src/lib/rbac.js", import.meta.url));
  for (const r of ASSIGNABLE_ROLES) if (!src.includes(`"${r}"`)) throw new Error(`${r} missing in rbac.js`);
});
