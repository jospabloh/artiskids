// Lives at the functions ROOT: every directory under base44/functions/ is a
// deployed endpoint and a test file is not one.
//
// What this protects: the Permisos matrix (Module 3) lets a family admin
// change what a role can do, and every change lands in RolePermission, which
// content's canWrite() reads on every write. These cases are the edits that
// must never be accepted, plus the one rule that keeps the table clean.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { decideOverride } from "./family/_permissionOverride.ts";
import { PERMISSION_REGISTRY } from "./family/_permissions.generated.ts";

Deno.test("an admin can take uploading away from members", () => {
  const d = decideOverride(PERMISSION_REGISTRY, "member", "Dibujos:upload", false);
  assert(d.ok);
  assert(d.ok && d.storeRow);
});

Deno.test("no override can grant family-management powers", () => {
  // A row granting Familia:manage_members would promote a member to the
  // admin's powers -- the escalation closed on 2026-09-24.
  for (const key of ["Familia:manage_members", "Familia:danger_zone", "Familia:manage_billing"]) {
    const d = decideOverride(PERMISSION_REGISTRY, "member", key, true);
    assertFalse(d.ok, key);
  }
});

Deno.test("only the app's two family roles can be edited", () => {
  // "admin" is the platform tier (User.role), never a family role.
  assertFalse(decideOverride(PERMISSION_REGISTRY, "admin", "Dibujos:upload", false).ok);
  assertFalse(decideOverride(PERMISSION_REGISTRY, "owner", "Dibujos:upload", false).ok);
});

Deno.test("keys outside the registry are refused", () => {
  assertFalse(decideOverride(PERMISSION_REGISTRY, "member", "Dibujos:publish", true).ok);
  assertFalse(decideOverride(PERMISSION_REGISTRY, "member", "nonsense", true).ok);
  assertFalse(decideOverride(PERMISSION_REGISTRY, "member", "Dibujos:upload", "yes").ok);
  // A trailing segment would validate as Dibujos:upload but store a key
  // canWrite never reads; prototype names must not pass as registry keys.
  assertFalse(decideOverride(PERMISSION_REGISTRY, "member", "Dibujos:upload:junk", false).ok);
  assertFalse(decideOverride(PERMISSION_REGISTRY, "member", "constructor:name", true).ok);
  assertFalse(decideOverride(PERMISSION_REGISTRY, "member", "toString:call", true).ok);
});

Deno.test("setting a value back to the default drops the row instead of storing it", () => {
  // Members upload by default; "allowed: true" is not an override.
  const same = decideOverride(PERMISSION_REGISTRY, "member", "Dibujos:upload", true);
  assert(same.ok);
  assertEquals(same.ok && same.storeRow, false);
  const reset = decideOverride(PERMISSION_REGISTRY, "member", "Dibujos:upload", null);
  assertEquals(reset.ok && reset.storeRow, false);
});
