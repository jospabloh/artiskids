// Import-free so base44/functions/permissionOverride.test.ts can load it
// without the Base44 runtime. Decides whether a family admin's edit to the
// Permisos matrix (Module 3) is one this app accepts, before anything is
// written to RolePermission.

export const OVERRIDABLE_ROLES = ["family_admin", "member"] as const;

// The Familia section is registry-only. A RolePermission row granting
// Familia:manage_members is a row that promotes its holder to family_admin's
// powers, so these keys are never delegable through data -- the family
// router doesn't even read overrides for them (security fix 2026-09-24).
// Refusing the write keeps the matrix honest: it can't show an override the
// server ignores.
export const LOCKED_SECTIONS = ["Familia"] as const;

export type OverrideDecision =
  | { ok: true; key: string; section: string; action: string; storeRow: boolean }
  | { ok: false; error: string };

/**
 * @param registry  the generated PERMISSION_REGISTRY copy
 * @param role      the role column being edited
 * @param key       "Section:action"
 * @param allowed   true/false to set; null to drop the override
 * storeRow is false when the requested value equals the registry default
 * (or allowed is null): the override row is deleted instead of stored, so
 * the table only ever holds real departures from the default.
 */
export function decideOverride(
  registry: Record<string, Record<string, string[]>>,
  role: unknown,
  key: unknown,
  allowed: unknown,
): OverrideDecision {
  if (typeof role !== "string" || !(OVERRIDABLE_ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: "invalid role" };
  }
  if (typeof key !== "string") return { ok: false, error: "invalid permission_key" };
  const parts = key.split(":");
  if (parts.length !== 2) return { ok: false, error: "invalid permission_key" };
  const [section, action] = parts;
  // Own properties only: "constructor:name" must not resolve through the
  // prototype chain into something that looks like a registry entry.
  if (!Object.hasOwn(registry, section) || !Object.hasOwn(registry[section], action)) {
    return { ok: false, error: "unknown permission_key" };
  }
  if ((LOCKED_SECTIONS as readonly string[]).includes(section)) {
    return { ok: false, error: "this permission can't be changed" };
  }
  if (allowed !== null && typeof allowed !== "boolean") {
    return { ok: false, error: "allowed must be true, false or null" };
  }
  const defaultValue = registry[section][action].includes(role);
  const storeRow = allowed !== null && allowed !== defaultValue;
  return { ok: true, key: `${section}:${action}`, section, action, storeRow };
}
