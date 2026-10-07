import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { callFunction } from "@/lib/functions";
import { notifyMissionControl } from "@/lib/notifyMissionControl";
import SupportEscapeHatch from "@/components/SupportEscapeHatch";
import TypedConfirmDialog from "@/components/TypedConfirmDialog";
import { FAMILY_ROLES, FAMILY_ROLE_LABELS, isFamilyAdmin } from "@/lib/rbac";
import { quotaBytesFor, formatBytes } from "@/lib/storageQuota";
import { Users, UserPlus, Download, Smartphone, ShieldAlert, Loader2, Trash2 } from "lucide-react";

const BILLING_LABELS = {
  trial: "Prueba",
  active: "Activa",
  view_only: "Solo lectura",
  suspended: "Suspendida",
};

export default function Account() {
  const navigate = useNavigate();
  const { user, logout, checkUserAuth } = useAuth();
  const admin = isFamilyAdmin(user);

  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // A load failure leaves nothing to render (no family/members/sessions),
  // so it gets the full-page escape hatch rather than a banner over an
  // empty page. An action (run()) failure is different -- the page still
  // has valid data underneath, so that one stays a banner, just no longer
  // showing raw text for a non-router failure.
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [fam, memberData, sessionData, requestData] = await Promise.all([
        base44.entities.Family.get(user.family_id),
        callFunction("family", "listMembers"),
        callFunction("session", "listSessions"),
        // Admin-only on the server; a member would get a 403 and trip the
        // load-failure screen, so members don't ask.
        admin ? callFunction("family", "listJoinRequests") : null,
      ]);
      setFamily(fam);
      setMembers(memberData?.members ?? []);
      setSessions(sessionData?.sessions ?? []);
      setJoinRequests(requestData?.requests ?? []);
    } catch (err) {
      setLoadFailed(true);
      notifyMissionControl({ user, message: "No pudo cargar su página de cuenta en ArtisKids -- error al leer la familia o llamar las funciones family/session." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (key, action) => {
    setError("");
    setActionFailed(false);
    setBusy(key);
    try {
      await action();
    } catch (err) {
      if (err.isRouterError) {
        setError(err.message);
      } else {
        setActionFailed(true);
        notifyMissionControl({ user, message: `No pudo completar una acción de cuenta en ArtisKids (${key}) -- error al llamar una función.` });
      }
    } finally {
      setBusy("");
    }
  };

  const changeRole = (targetUserId, newRole) =>
    run(`role:${targetUserId}`, async () => {
      await callFunction("family", "setMemberRole", { target_user_id: targetUserId, new_role: newRole });
      await load();
    });

  const delegate = (targetUserId) => {
    // Module 7: promoting is its own confirmed step, and says plainly that
    // the person promoting keeps their own admin role.
    const target = members.find((m) => m.id === targetUserId);
    if (!confirm(`${target?.email || "Este miembro"} también será administrador de la familia y podrá gestionar miembros y eliminarla. Tú sigues siendo administrador. ¿Continuar?`)) return;
    return run(`delegate:${targetUserId}`, async () => {
      await callFunction("family", "delegateAdmin", { target_user_id: targetUserId });
      await load();
    });
  };

  const [joinRoles, setJoinRoles] = useState({});
  const answerJoinRequest = (targetUserId, approve) =>
    run(`join:${targetUserId}`, async () => {
      await callFunction("family", approve ? "approveJoinRequest" : "rejectJoinRequest", {
        target_user_id: targetUserId,
        ...(approve ? { role: joinRoles[targetUserId] || FAMILY_ROLES.MEMBER } : {}),
      });
      await load();
    });

  const removeMember = (targetUserId) => {
    if (!confirm("¿Quitar a este miembro de la familia?")) return;
    run(`remove:${targetUserId}`, async () => {
      await callFunction("family", "removeMember", { target_user_id: targetUserId });
      await load();
    });
  };

  const revokeSession = (sessionId) => {
    // The server can't end one device's login on its own, so this ends all
    // of them -- this one included (see _tokenCutoff.ts).
    if (!window.confirm("Por seguridad, esto cierra la sesión en todos tus dispositivos, incluido este. Tendrás que volver a entrar. ¿Continuar?")) return;
    return run(`session:${sessionId}`, async () => {
      await callFunction("session", "revokeSession", { session_id: sessionId });
      base44.auth.logout();
    });
  };

  const exportData = () =>
    run("export", async () => {
      const data = await callFunction("family", "exportData");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `artiskids-${family?.name || "familia"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

  // Which irreversible action is waiting on its typed confirmation, if any.
  const [pendingDelete, setPendingDelete] = useState(null); // null | "account" | "family"

  const deleteMyAccount = () =>
    run("deleteMyAccount", async () => {
      await callFunction("family", "deleteMyAccount");
      logout(false);
      navigate("/login", { replace: true });
    });

  const deleteFamily = () =>
    run("deleteFamily", async () => {
      await callFunction("family", "deleteFamily");
      await checkUserAuth();
      navigate("/bienvenida", { replace: true });
    });

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" /></div>;
  }

  if (loadFailed) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-stone-100 shadow-sm p-6 text-center space-y-4">
        <p className="text-sm text-stone-600">
          Algo no funcionó de nuestro lado y no pudimos cargar tu cuenta.
          No es algo que tú puedas corregir — escríbenos y te ayudamos directo.
        </p>
        <SupportEscapeHatch contextMessage="Hola, no puedo cargar mi página de cuenta en ArtisKids." />
        <button type="button" onClick={load} className="w-full text-sm text-stone-400 hover:text-stone-600">
          Intentar de nuevo
        </button>
      </div>
    );
  }

  const soleAdmin = admin && members.filter((m) => m.family_role === "family_admin").length <= 1;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-stone-800 mb-1">Mi cuenta</h1>
        <p className="text-sm text-stone-500 break-all">{user?.email}</p>
      </div>

      {actionFailed ? (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 space-y-3">
          <p className="text-sm text-stone-600">
            Algo no funcionó de nuestro lado. No es algo que tú puedas corregir — escríbenos y te ayudamos directo.
          </p>
          <SupportEscapeHatch contextMessage="Hola, algo falló al usar mi cuenta en ArtisKids." />
        </div>
      ) : (
        error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-sm">{error}</div>
      )}

      <section className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
        <h2 className="font-heading font-semibold text-stone-800 mb-3">{family?.name}</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
            {BILLING_LABELS[family?.billing_status] || family?.billing_status}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-stone-50 text-stone-600 border border-stone-200">
            {FAMILY_ROLE_LABELS[user?.family_role] || user?.family_role}
          </span>
        </div>
        {family?.billing_status === "trial" && family?.trial_end_at && (
          <p className="text-xs text-stone-400 mt-3">
            Tu prueba vence el{" "}
            {new Date(family.trial_end_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
        {(() => {
          const quota = quotaBytesFor(family?.billing_status);
          if (!quota) return null;
          const used = Number(family?.storage_used_bytes ?? 0);
          const pct = Math.min(100, (used / quota) * 100);
          return (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                <span>Almacenamiento</span>
                <span>{formatBytes(used)} de {formatBytes(quota)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 90 ? "bg-rose-400" : "bg-amber-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()}
        {family?.join_code && (
          <p className="text-xs text-stone-400 mt-3">
            Código de invitación: <span className="font-mono font-semibold text-stone-600">{family.join_code}</span>
          </p>
        )}
      </section>

      {admin && joinRequests.length > 0 && (
        <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
          <h2 className="font-heading font-semibold text-stone-800 mb-1 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-600" /> Solicitudes para unirse ({joinRequests.length})
          </h2>
          <p className="text-xs text-stone-500 mb-4">
            Usaron el código de invitación. Elige el rol y aprueba solo a quien conozcas: verán todos los dibujos de la familia.
          </p>
          <div className="space-y-2">
            {joinRequests.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 bg-white rounded-xl px-3 py-2.5">
                <div className="min-w-0 text-sm font-medium text-stone-700 truncate">{r.email}</div>
                <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                  <select
                    aria-label={`Rol para ${r.email}`}
                    value={joinRoles[r.id] || FAMILY_ROLES.MEMBER}
                    onChange={(e) => setJoinRoles((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="text-xs rounded-full border border-stone-200 bg-white px-2 py-1.5 text-stone-600"
                  >
                    {Object.values(FAMILY_ROLES).map((role) => (
                      <option key={role} value={role}>
                        {FAMILY_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => answerJoinRequest(r.id, true)}
                    disabled={busy === `join:${r.id}`}
                    className="text-xs px-3 py-1.5 rounded-full bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-60 transition"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => answerJoinRequest(r.id, false)}
                    disabled={busy === `join:${r.id}`}
                    className="text-xs px-3 py-1.5 rounded-full border border-stone-200 text-stone-500 hover:border-rose-300 hover:text-rose-500 disabled:opacity-60 transition"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
        <h2 className="font-heading font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-stone-400" /> Miembros ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 bg-stone-50 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-700 truncate">{m.email}</div>
                <div className="text-xs text-stone-400">{FAMILY_ROLE_LABELS[m.family_role] || m.family_role}</div>
              </div>
              {admin && m.id !== user.id && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {m.family_role === "member" ? (
                    <button
                      onClick={() => delegate(m.id)}
                      disabled={busy === `delegate:${m.id}`}
                      className="text-xs px-2.5 py-1 rounded-full border border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600 transition"
                    >
                      Hacer admin
                    </button>
                  ) : (
                    <button
                      onClick={() => changeRole(m.id, "member")}
                      disabled={busy === `role:${m.id}`}
                      className="text-xs px-2.5 py-1 rounded-full border border-stone-200 text-stone-500 hover:border-stone-300 transition"
                    >
                      Quitar admin
                    </button>
                  )}
                  <button
                    onClick={() => removeMember(m.id)}
                    disabled={busy === `remove:${m.id}`}
                    className="text-stone-300 hover:text-rose-500 transition p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
        <h2 className="font-heading font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-stone-400" /> Sesiones activas
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-stone-400">No hay sesiones registradas todavía.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 bg-stone-50 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-700">{s.device || "Navegador"}</div>
                  <div className="text-xs text-stone-400">
                    {s.status === "active" ? "Activa ahora" : s.status === "passive" ? "Inactiva" : "Cerrada"}
                  </div>
                </div>
                {s.status !== "revoked" && (
                  <button
                    onClick={() => revokeSession(s.id)}
                    disabled={busy === `session:${s.id}`}
                    className="text-xs px-2.5 py-1 rounded-full border border-stone-200 text-stone-500 hover:border-rose-300 hover:text-rose-500 transition shrink-0"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
        <button
          onClick={exportData}
          disabled={busy === "export"}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 transition"
        >
          {busy === "export" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exportar los datos de mi familia
        </button>
      </section>

      <section className="bg-rose-50 rounded-2xl border border-rose-100 p-5">
        <h2 className="font-heading font-semibold text-rose-700 mb-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Zona de peligro
        </h2>
        <div className="space-y-2">
          {admin && soleAdmin && (
            <p className="text-xs text-rose-600 bg-rose-100/60 rounded-lg px-3 py-2">
              Eres el único administrador. Hazle admin a otro miembro antes de eliminar tu cuenta.
            </p>
          )}
          <button
            onClick={() => setPendingDelete("account")}
            disabled={busy === "deleteMyAccount" || (admin && soleAdmin)}
            className="w-full text-sm px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 font-medium hover:bg-rose-100 disabled:opacity-50 transition"
          >
            Eliminar mi cuenta
          </button>
          {admin && (
            <button
              onClick={() => setPendingDelete("family")}
              disabled={busy === "deleteFamily"}
              className="w-full text-sm px-4 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 transition"
            >
              Eliminar la familia completa
            </button>
          )}
        </div>
      </section>

      <TypedConfirmDialog
        open={pendingDelete === "account"}
        title="Eliminar tu cuenta"
        description="Se elimina tu cuenta: sales de la familia y se borran tus comentarios y reacciones. Los dibujos que subiste se quedan en la familia. Esta acción no se puede deshacer."
        phrase="ELIMINAR"
        confirmLabel="Eliminar mi cuenta"
        busy={busy === "deleteMyAccount"}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          await deleteMyAccount();
          setPendingDelete(null);
        }}
      />
      <TypedConfirmDialog
        open={pendingDelete === "family"}
        title="Eliminar la familia completa"
        description="Se borran todos los dibujos, comentarios y reacciones, y todos los miembros pierden el acceso. Esta acción no se puede deshacer."
        phrase={family?.name || "ELIMINAR"}
        confirmLabel="Eliminar la familia"
        busy={busy === "deleteFamily"}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          await deleteFamily();
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
