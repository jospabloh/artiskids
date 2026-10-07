import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// Module 7's confirmation step for the irreversible danger-zone actions. A
// browser confirm() is one reflexive click away from deleting a family's
// drawings; making the person type a specific phrase means the click can't
// happen by accident, and naming *what* gets deleted in the phrase (the
// family's own name) means they can't confirm the wrong thing.
//
// Matching ignores surrounding spaces and letter case: the point is intent,
// not catching someone who typed "familia mochi" for "Familia Mochi".
export default function TypedConfirmDialog({
  open,
  title,
  description,
  phrase,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const matches = typed.trim().toLowerCase() === String(phrase ?? "").trim().toLowerCase();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="typed-confirm-title"
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-3"
      >
        <h2 id="typed-confirm-title" className="font-heading font-semibold text-lg text-rose-700">{title}</h2>
        <p className="text-sm text-stone-600">{description}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (matches && !busy) onConfirm();
          }}
          className="space-y-3"
        >
          <label className="block text-sm text-stone-600">
            Para confirmar, escribe <span className="font-semibold text-stone-800">{phrase}</span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-1.5 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
          </label>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="text-sm px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!matches || busy}
              className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
