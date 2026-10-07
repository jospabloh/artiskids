import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { callFunction } from "@/lib/functions";
import { defaultAllowed, permissionKey } from "@/lib/permissionRegistry";
import { isPlatformAdmin } from "@/lib/rbac";

// Module 3's client half: can() hides or disables what a role isn't allowed
// to do. It mirrors content's canWrite() precedence exactly, so the UI and
// the server never disagree:
//   1. platform admin (User.role "admin") -> always;
//   2. this family's RolePermission override for (role, key) -> its value,
//      except the Familia section, which is registry-only on the server;
//   3. the registry default.
// This is only the UI. Every write is re-checked server-side regardless.
export const PERMISSIONS_QUERY_KEY = "familyPermissions";

export function usePermissions() {
  const { user } = useAuth();
  const familyId = user?.family_id;

  const { data, isLoading } = useQuery({
    queryKey: [PERMISSIONS_QUERY_KEY, familyId],
    queryFn: () => callFunction("family", "listPermissions"),
    enabled: Boolean(familyId),
    staleTime: 60_000,
  });
  const overrides = data?.overrides ?? [];

  const can = useCallback(
    (section, action) => {
      if (isPlatformAdmin(user)) return true;
      const role = user?.family_role;
      if (!role) return false;
      if (section !== "Familia") {
        const key = permissionKey(section, action);
        const row = overrides.find((o) => o.role === role && o.permission_key === key);
        if (row) return Boolean(row.allowed);
      }
      return defaultAllowed(section, action, role);
    },
    [user, overrides],
  );

  return { can, overrides, loading: isLoading };
}
