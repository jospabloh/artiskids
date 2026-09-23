import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { callFunction } from "@/lib/functions";
import { notifyMissionControl } from "@/lib/notifyMissionControl";
import SupportEscapeHatch from "@/components/SupportEscapeHatch";
import { Users, Loader2, ArrowRight, Hourglass } from "lucide-react";

// Module 18-retired's entry point: an authenticated user with no family_id
// lands here (see the RequireFamily gate in App.jsx) and either creates a
// family (becomes its family_admin) or joins one with a code (becomes a
// member) -- both call the family function router, never a direct write,
// since User.family_id/family_role are RLS-write-locked to admin.
//
// This is the very first screen an authenticated user can get stuck on, so
// it follows Module 10's "no dead ends" rule even though that module is
// written about login: a failure here must never show a raw platform error
// with nothing the user can do about it. callFunction's isRouterError flag
// tells the two submit handlers below which kind of failure they got --
// see fatalError's own comment for the split.
export default function FamilyOnboarding() {
  const navigate = useNavigate();
  const { user, checkUserAuth } = useAuth();
  const [mode, setMode] = useState(null); // null | "create" | "join"
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  // Set only for a failure callFunction could not attribute to the router
  // itself (function not deployed, network failure, a 500) -- something a
  // "corrige el dato" message can't help with, so this renders the WhatsApp
  // / correo escape hatch instead of the inline banner. Always available
  // (unlike the in-app Soporte page, which itself depends on the same
  // backend that just failed) since it's a plain external link.
  const [fatalError, setFatalError] = useState(false);
  const [loading, setLoading] = useState(false);
  // A join code only REQUESTS access (Module 2); the family's admin approves
  // it from Mi cuenta. Driven by user.pending_family_id rather than local
  // state, because checkUserAuth() remounts this page and a reload must
  // land back on the waiting screen too.
  const [pendingFamilyName, setPendingFamilyName] = useState(null);
  const hasPendingRequest = Boolean(user?.pending_family_id) && !user?.family_id;

  useEffect(() => {
    if (!hasPendingRequest) return;
    callFunction("family", "joinRequestStatus")
      .then((data) => setPendingFamilyName(data?.pending?.family_name ?? null))
      .catch(() => {});
  }, [hasPendingRequest]);

  const checkApproval = async () => {
    setLoading(true);
    try {
      await checkUserAuth();
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async () => {
    setLoading(true);
    try {
      await callFunction("family", "cancelJoinRequest");
      await checkUserAuth();
    } catch {
      setFatalError(true);
    } finally {
      setLoading(false);
    }
  };

  const afterSuccess = async () => {
    // The caller's own User row now carries family_id/family_role -- refresh
    // the auth context's cached copy so RequireFamily lets them through on
    // the very next render, not just after a reload.
    await checkUserAuth();
    navigate("/", { replace: true });
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    setFatalError(false);
    setLoading(true);
    try {
      await callFunction("family", "createFamily", { name: name.trim() });
      await afterSuccess();
    } catch (err) {
      if (err.isRouterError) setError(err.message);
      else {
        setFatalError(true);
        notifyMissionControl({ user, message: "No pudo crear su familia en ArtisKids -- error al llamar la función family (probablemente no registrada en el backend todavía)." });
      }
    } finally {
      setLoading(false);
    }
  };

  const submitJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError("");
    setFatalError(false);
    setLoading(true);
    try {
      await callFunction("family", "redeemCode", { join_code: joinCode.trim().toUpperCase() });
      // Not a member yet: refreshing the user brings back pending_family_id,
      // which switches this page to the waiting screen.
      await checkUserAuth();
    } catch (err) {
      if (err.isRouterError) setError(err.message);
      else {
        setFatalError(true);
        notifyMissionControl({ user, message: "No pudo unirse a una familia con un código en ArtisKids -- error al llamar la función family (probablemente no registrada en el backend todavía)." });
      }
    } finally {
      setLoading(false);
    }
  };

  if (user?.family_id) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdf8f3] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="ArtisKids" className="w-14 h-14 mx-auto rounded-2xl object-cover shadow-sm mb-4" />
          <h1 className="font-heading font-bold text-2xl text-stone-800">Bienvenido a ArtisKids</h1>
          <p className="text-stone-500 mt-2 text-sm">
            Cada familia tiene su propia cápsula. Crea la tuya o únete con un código.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
          {fatalError ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-stone-600">
                Algo no funcionó de nuestro lado y no pudimos {mode === "join" ? "unirte a la" : "crear tu"} familia.
                No es algo que tú puedas corregir — escríbenos y te ayudamos directo.
              </p>
              <SupportEscapeHatch
                contextMessage={`Hola, quiero ${mode === "join" ? "unirme a una familia con un código" : "crear mi familia"} en ArtisKids y me salió un error.`}
              />
              <button
                type="button"
                onClick={() => setFatalError(false)}
                className="w-full text-sm text-stone-400 hover:text-stone-600"
              >
                Intentar de nuevo
              </button>
            </div>
          ) : hasPendingRequest ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center">
                <Hourglass className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-stone-800">Solicitud enviada</p>
                <p className="text-sm text-stone-500 mt-1">
                  {pendingFamilyName ? <>Pediste unirte a <span className="font-medium text-stone-700">{pendingFamilyName}</span>. </> : null}
                  Un administrador de la familia tiene que aprobarte desde <span className="font-medium">Mi cuenta</span>. Avísale para que no espere.
                </p>
              </div>
              <button
                type="button"
                onClick={checkApproval}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ya me aprobaron"}
              </button>
              <button
                type="button"
                onClick={cancelRequest}
                disabled={loading}
                className="w-full text-sm text-stone-400 hover:text-stone-600"
              >
                Cancelar solicitud
              </button>
            </div>
          ) : (
          <>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-600 text-sm">{error}</div>
          )}

          {mode === null && (
            <div className="space-y-3">
              <button
                onClick={() => setMode("create")}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition text-left"
              >
                <div>
                  <div className="font-semibold text-stone-800">Crear una familia</div>
                  <div className="text-xs text-stone-500">30 días de prueba, sin tarjeta</div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600" />
              </button>
              <button
                onClick={() => setMode("join")}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition text-left"
              >
                <div>
                  <div className="font-semibold text-stone-800">Unirme con un código</div>
                  <div className="text-xs text-stone-500">Alguien de tu familia ya tiene una cápsula</div>
                </div>
                <Users className="w-4 h-4 text-stone-400" />
              </button>
            </div>
          )}

          {mode === "create" && (
            <form onSubmit={submitCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1.5">Nombre de la familia</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Familia Herrera"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Crear familia"}
              </button>
              <button
                type="button"
                onClick={() => { setMode(null); setError(""); }}
                className="w-full text-sm text-stone-400 hover:text-stone-600"
              >
                Volver
              </button>
            </form>
          )}

          {mode === "join" && (
            <form onSubmit={submitJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1.5">Código de invitación</label>
                <input
                  autoFocus
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="ABCD1234"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 uppercase tracking-wider"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pedir unirme"}
              </button>
              <button
                type="button"
                onClick={() => { setMode(null); setError(""); }}
                className="w-full text-sm text-stone-400 hover:text-stone-600"
              >
                Volver
              </button>
            </form>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
