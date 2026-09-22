// The one client registry file (Module 3). Every write path -- both the
// client's can() checks (hide/disable UI) and each Safe function's own
// server-side re-check -- reads this same table, so a change here can never
// silently diverge between what the UI shows and what the backend allows.
//
// Server-side copies live at base44/functions/<fn>/_permissions.generated.ts,
// written ONLY by scripts/generatePermissionManifests.mjs -- never hand-edit
// a generated copy, and never skip regenerating after changing this file.
//
// Precedence, checked in this order by both sides:
//   1. platform owner / User.role === "admin" -> always allowed.
//   2. a RolePermission override for (family_id, role, key) -> its value.
//   3. this registry's own default for (section, action, role).
//   4. gated by Family.billing_status first (view_only/suspended reject
//      every write action, checked before 1-3 even run).

export const PERMISSION_REGISTRY = Object.freeze({
  Dibujos: {
    upload: ["family_admin", "member"],
    delete: ["family_admin", "member"],
  },
  Comentarios: {
    create: ["family_admin", "member"],
    delete: ["family_admin", "member"],
  },
  Reacciones: {
    create: ["family_admin", "member"],
  },
  Catalogo: {
    // Child/Parent/Relative catalog entries (CatalogList.jsx).
    manage: ["family_admin", "member"],
  },
  Familia: {
    manage_members: ["family_admin"],
    manage_billing: ["family_admin"],
    danger_zone: ["family_admin"],
  },
});

export function permissionKey(section, action) {
  return `${section}:${action}`;
}

/** The registry's own default, ignoring any RolePermission override. */
export function defaultAllowed(section, action, role) {
  return PERMISSION_REGISTRY[section]?.[action]?.includes(role) ?? false;
}

/** Every key this registry defines, for the Permisos matrix page and the
 *  generator to iterate over. */
export function allPermissionKeys() {
  return Object.entries(PERMISSION_REGISTRY).flatMap(([section, actions]) =>
    Object.keys(actions).map((action) => permissionKey(section, action)),
  );
}
