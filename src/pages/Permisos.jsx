import { useAuth } from "@/lib/AuthContext";
import { PERMISSION_REGISTRY } from "@/lib/permissionRegistry";
import { FAMILY_ROLE_LABELS, isPlatformAdmin } from "@/lib/rbac";
import { ShieldCheck, Check, X } from "lucide-react";

const SECTION_LABELS = {
  Dibujos: "Dibujos",
  Comentarios: "Comentarios",
  Reacciones: "Reacciones",
  Catalogo: "Catálogo (hijos, padres, familiares)",
  Familia: "Familia",
};

const ACTION_LABELS = {
  upload: "Subir",
  delete: "Eliminar",
  create: "Crear",
  manage: "Gestionar",
  manage_members: "Gestionar miembros",
  manage_billing: "Gestionar el plan",
  danger_zone: "Zona de peligro",
};

// Module 2/3's surfacing half: what the registry allows is a promise the UI
// can show and prove, not a secret the Safe functions enforce silently.
// This is a read-only mirror of PERMISSION_REGISTRY (the same file every
// Safe function's own re-check reads) -- no separate source of truth to
// drift from it.
export default function Permisos() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);
  const role = user?.family_role;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-stone-800 mb-1">Permisos</h1>
        <p className="text-sm text-stone-500">
          Lo que puede hacer cada rol en tu familia. Tu rol actual:{" "}
          <span className="font-semibold text-stone-700">
            {platformAdmin ? "Administrador de la plataforma" : FAMILY_ROLE_LABELS[role] || "sin definir"}
          </span>
        </p>
      </div>

      {platformAdmin && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          Como administrador de la plataforma, tienes acceso completo sin importar el rol dentro de la familia.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        {Object.entries(PERMISSION_REGISTRY).map(([section, actions], i) => (
          <div key={section} className={i > 0 ? "border-t border-stone-100" : ""}>
            <div className="px-5 py-3 bg-stone-50 text-sm font-semibold text-stone-700">
              {SECTION_LABELS[section] || section}
            </div>
            <div className="divide-y divide-stone-50">
              {Object.entries(actions).map(([action, allowedRoles]) => {
                const allowed = platformAdmin || allowedRoles.includes(role);
                return (
                  <div key={action} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-stone-600">{ACTION_LABELS[action] || action}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-400">
                        {allowedRoles.map((r) => FAMILY_ROLE_LABELS[r] || r).join(", ")}
                      </span>
                      {allowed ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <X className="w-4 h-4 text-stone-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-400">
        Una anulación específica para tu familia puede cambiar alguno de estos valores;
        lo que se muestra aquí es la regla general.
      </p>
    </div>
  );
}
