import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { callFunction } from "@/lib/functions";
import { PERMISSION_REGISTRY, defaultAllowed, permissionKey } from "@/lib/permissionRegistry";
import { FAMILY_ROLES, FAMILY_ROLE_LABELS, isFamilyAdmin, isPlatformAdmin } from "@/lib/rbac";
import { PERMISSIONS_QUERY_KEY, usePermissions } from "@/lib/usePermissions";
import { ShieldCheck, Lock, Pencil, Check, Loader2 } from "lucide-react";

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

// Registry-only on the server (family/_permissionOverride.ts): a row that
// could grant these is a path to family_admin, so the matrix shows them but
// never lets anyone change them.
const LOCKED_SECTIONS = new Set(["Familia"]);
const ROLES = [FAMILY_ROLES.FAMILY_ADMIN, FAMILY_ROLES.MEMBER];

function GroupCheckbox({ state, disabled, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "mixed";
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={state === "on"}
      disabled={disabled}
      onChange={onChange}
      className="w-4 h-4 accent-amber-500 disabled:opacity-40"
    />
  );
}

// Module 3: the same PERMISSION_REGISTRY every function re-checks, shown as
// a matrix the family admin can change. Each change is written straight to
// RolePermission, the table content's canWrite() reads on every write --
// there is no second config surface for the backend to ignore.
export default function Permisos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { overrides, loading } = usePermissions();
  const platformAdmin = isPlatformAdmin(user);
  // Overrides belong to a family; with none there is nothing to edit.
  const canEdit = Boolean(user?.family_id) && (platformAdmin || isFamilyAdmin(user));
  const role = user?.family_role;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const effective = (section, action, r) => {
    if (!LOCKED_SECTIONS.has(section)) {
      const key = permissionKey(section, action);
      const row = overrides.find((o) => o.role === r && o.permission_key === key);
      if (row) return Boolean(row.allowed);
    }
    return defaultAllowed(section, action, r);
  };
  const isOverridden = (section, action, r) =>
    !LOCKED_SECTIONS.has(section) &&
    overrides.some((o) => o.role === r && o.permission_key === permissionKey(section, action));

  const save = async (changes, savingKey) => {
    setError("");
    setSaving(savingKey);
    try {
      for (const c of changes) {
        await callFunction("family", "setPermission", c);
      }
    } catch (err) {
      setError(err.isRouterError ? err.message : "No se pudo guardar el cambio. Intenta de nuevo.");
    } finally {
      await queryClient.invalidateQueries({ queryKey: [PERMISSIONS_QUERY_KEY] });
      setSaving("");
    }
  };

  const toggleCell = (section, action, r) =>
    save(
      [{ role: r, permission_key: permissionKey(section, action), allowed: !effective(section, action, r) }],
      `${section}:${action}:${r}`,
    );

  const groupState = (section, r) => {
    const values = Object.keys(PERMISSION_REGISTRY[section]).map((a) => effective(section, a, r));
    if (values.every(Boolean)) return "on";
    if (values.some(Boolean)) return "mixed";
    return "off";
  };

  const toggleGroup = (section, r) => {
    const next = groupState(section, r) !== "on";
    const changes = Object.keys(PERMISSION_REGISTRY[section])
      .filter((a) => effective(section, a, r) !== next)
      .map((a) => ({ role: r, permission_key: permissionKey(section, a), allowed: next }));
    if (changes.length) save(changes, `${section}:*:${r}`);
  };

  const resetSection = (section) => {
    const changes = overrides
      .filter((o) => o.permission_key.startsWith(`${section}:`))
      .map((o) => ({ role: o.role, permission_key: o.permission_key, allowed: null }));
    if (changes.length) save(changes, `${section}:reset`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-bold text-2xl text-stone-800 mb-1">Permisos</h1>
          <p className="text-sm text-stone-500">
            Lo que puede hacer cada rol en tu familia. Tu rol actual:{" "}
            <span className="font-semibold text-stone-700">
              {platformAdmin ? "Administrador de la plataforma" : FAMILY_ROLE_LABELS[role] || "sin definir"}
            </span>
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition ${
              editing
                ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                : "bg-white text-stone-600 border-stone-200 hover:border-amber-300"
            }`}
          >
            {editing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            {editing ? "Terminar" : "Editar permisos"}
          </button>
        )}
      </div>

      {platformAdmin && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          Como administrador de la plataforma, tienes acceso completo sin importar el rol dentro de la familia.
        </div>
      )}

      {editing && (
        <p className="text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2">
          Cada casilla se guarda en cuanto la cambias. Lo marcado con un punto ámbar es una decisión de tu familia;
          lo demás es la regla general de ArtisKids.
        </p>
      )}

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center px-5 py-2 text-xs font-medium text-stone-400 border-b border-stone-100">
          <span>Acción</span>
          {ROLES.map((r) => (
            <span key={r} className="text-center">{FAMILY_ROLE_LABELS[r]}</span>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-stone-300" /></div>
        ) : (
          Object.entries(PERMISSION_REGISTRY).map(([section, actions], i) => {
            const locked = LOCKED_SECTIONS.has(section);
            const sectionHasOverrides = overrides.some((o) => o.permission_key.startsWith(`${section}:`));
            return (
              <div key={section} className={i > 0 ? "border-t border-stone-100" : ""}>
                <div className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center px-5 py-3 bg-stone-50">
                  <span className="text-sm font-semibold text-stone-700 flex items-center gap-1.5 flex-wrap">
                    {SECTION_LABELS[section] || section}
                    {locked && <Lock className="w-3.5 h-3.5 text-stone-400" aria-label="No editable" />}
                    {editing && !locked && sectionHasOverrides && (
                      <button
                        type="button"
                        onClick={() => resetSection(section)}
                        disabled={Boolean(saving)}
                        className="text-xs font-normal text-amber-600 hover:underline disabled:opacity-50"
                      >
                        Restablecer
                      </button>
                    )}
                  </span>
                  {ROLES.map((r) => (
                    <span key={r} className="flex justify-center">
                      {editing && !locked ? (
                        saving === `${section}:*:${r}` ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        ) : (
                          <GroupCheckbox
                            state={groupState(section, r)}
                            disabled={Boolean(saving)}
                            onChange={() => toggleGroup(section, r)}
                            label={`${SECTION_LABELS[section]}: todo para ${FAMILY_ROLE_LABELS[r]}`}
                          />
                        )
                      ) : null}
                    </span>
                  ))}
                </div>
                <div className="divide-y divide-stone-50">
                  {Object.keys(actions).map((action) => (
                    <div key={action} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center px-5 py-3">
                      <span className="text-sm text-stone-600">{ACTION_LABELS[action] || action}</span>
                      {ROLES.map((r) => {
                        const value = effective(section, action, r);
                        const cellKey = `${section}:${action}:${r}`;
                        return (
                          <span key={r} className="flex justify-center items-center gap-1">
                            {saving === cellKey ? (
                              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            ) : (
                              <input
                                type="checkbox"
                                aria-label={`${ACTION_LABELS[action] || action} — ${FAMILY_ROLE_LABELS[r]}`}
                                checked={value}
                                disabled={!editing || locked || Boolean(saving)}
                                onChange={() => toggleCell(section, action, r)}
                                className="w-4 h-4 accent-amber-500 disabled:opacity-60"
                              />
                            )}
                            {isOverridden(section, action, r) && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Decisión de tu familia" />
                            )}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {locked && (
                  <p className="px-5 pb-3 text-xs text-stone-400">
                    Estos permisos son fijos: solo un administrador de la familia puede gestionar miembros, el plan
                    y la zona de peligro.
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {!canEdit && (
        <p className="text-xs text-stone-400">Solo un administrador de la familia puede cambiar estos permisos.</p>
      )}
    </div>
  );
}
