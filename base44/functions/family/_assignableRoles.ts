// Roles a family admin may hand out when approving a join request.
// Whitelist, never derived from the request: platform roles ("admin"/"user",
// Base44's built-in User.role) must be impossible to grant from here.
// Keep in sync with src/lib/rbac.js FAMILY_ROLES.
export const ASSIGNABLE_ROLES = ["family_admin", "member"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Omitted role means "member" (older clients never sent one). Anything present
 *  but outside the whitelist is rejected (null), not coerced. */
export function resolveApprovedRole(raw: unknown): AssignableRole | null {
  if (raw === undefined || raw === null || raw === "") return "member";
  return (ASSIGNABLE_ROLES as readonly unknown[]).includes(raw) ? (raw as AssignableRole) : null;
}
