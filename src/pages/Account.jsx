import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { callFunction } from "@/lib/functions";
import { FAMILY_ROLE_LABELS, isFamilyAdmin } from "@/lib/rbac";
import { Users, Download, Smartphone, ShieldAlert, Loader2, Trash2 } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [fam, memberData, sessionData] = await Promise.all([
        base44.entities.Family.get(user.family_id),
        callFunction("family", "listMembers"),
        callFunction("session", "listSessions"),
      ]);
      setFamily(fam);
      setMembers(memberData?.members ?? []);
      setSessions(sessionData?.sessions ?? []);
    } catch (err) {
      setError(err.message);
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
    setBusy(key);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const changeRole = (targetUserId, newRole) =>
    run(`role:${targetUserId}`, async () => {
      await callFunction("family", "setMemberRole", { target_user_id: targetUserId, new_role: newRole });
      await load();
    });

  const delegate = (targetUserId) =>
    run(`delegate:${targetUserId}`, async () => {
      await callFunction("family", "delegateAdmin", { target_user_id: targetUserId });
      await load();
    });

  const removeMember = (targetUserId) => {
    if (!confirm("¿Quitar a este miembro de la familia?")) return;
    run(`remove:${targetUserId}`, async () => {
      await callFunction("family", "removeMember", { target_user_id: targetUserId });
      await load();
    });
  };

  const revokeSession = (sessionId) =>
    run(`session:${sessionId}`, async () => {
      await callFunction("session", "revokeSession", { session_id: sessionId });
      await load();
    });

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

  const deleteMyAccount = () => {
    if (!confirm("¿Eliminar tu cuenta? Esta acción no se puede deshacer.")) return;
    run("deleteMyAccount", async () => {
      await callFunction("family", "deleteMyAccount");
      logout(false);
      navigate("/login", { replace: true });
    });
  };

  const deleteFamily = () => {
    if (!confirm(`¿Eliminar la familia "${family?.name}" por completo? Se borran todos los dibujos, comentarios y reacciones. Esta acción no se puede deshacer.`)) return;
    run("deleteFamily", async () => {
      await callFunction("family", "deleteFamily");
      await checkUserAuth();
      navigate("/bienvenida", { replace: true });
    });
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" /></div>;
  }

  const soleAdmin = admin && members.filter((m) => m.family_role === "family_admin").length <= 1;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-stone-800 mb-1">Mi cuenta</h1>
        <p className="text-sm text-stone-500">{user?.email}</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-sm">{error}</div>}

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
        {family?.join_code && (
          <p className="text-xs text-stone-400 mt-3">
            Código de invitación: <span className="font-mono font-semibold text-stone-600">{family.join_code}</span>
          </p>
        )}
      </section>

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
            onClick={deleteMyAccount}
            disabled={busy === "deleteMyAccount" || (admin && soleAdmin)}
            className="w-full text-sm px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 font-medium hover:bg-rose-100 disabled:opacity-50 transition"
          >
            Eliminar mi cuenta
          </button>
          {admin && (
            <button
              onClick={deleteFamily}
              disabled={busy === "deleteFamily"}
              className="w-full text-sm px-4 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 transition"
            >
              Eliminar la familia completa
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
