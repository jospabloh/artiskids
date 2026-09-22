// The one file that names artiskids' role model (Module 2). Two roles within
// a family -- deliberately not more, see CLAUDE.md's frozen decisions. Never
// conflate these with the platform-tier User.role ("admin"/"user", Base44's
// own built-in field) -- that's the service/platform-owner tier, checked
// separately as isPlatformAdmin() below, and it's what every RLS rule's
// admin branch actually means. A family_admin is NOT a platform admin.

export const FAMILY_ROLES = Object.freeze({
  FAMILY_ADMIN: "family_admin",
  MEMBER: "member",
});

export const FAMILY_ROLE_LABELS = Object.freeze({
  family_admin: "Administrador",
  member: "Miembro",
});

/** @param {{family_role?: string}} user */
export function isFamilyAdmin(user) {
  return user?.family_role === FAMILY_ROLES.FAMILY_ADMIN;
}

/** @param {{role?: string}} user */
export function isPlatformAdmin(user) {
  return user?.role === "admin";
}

/** True once a user has joined or created a family. */
export function hasFamily(user) {
  return Boolean(user?.family_id);
}
