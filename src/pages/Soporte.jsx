import { useState } from "react";
import { callFunction } from "@/lib/functions";
import { LifeBuoy, MessageCircle, Mail, Loader2, CheckCircle2 } from "lucide-react";

// Module 8's client half. WhatsApp and correo are always shown, not just on
// error -- the portfolio's rule (learned the hard way in acaciaco-site's
// Roseta flow) is that a form is a convenience, never the only door.
const WHATSAPP = "449 895 8291";
const WHATSAPP_HREF = "https://wa.me/524498958291";
const EMAIL = "soporte@acaciaco.com.mx";

export default function Soporte() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setError("");
    setLoading(true);
    try {
      await callFunction("support", "createTicket", { subject: subject.trim(), message: message.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-stone-800 mb-1 flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-amber-500" /> Soporte
        </h1>
        <p className="text-sm text-stone-500">¿Algo no funciona o tienes una idea? Cuéntanos.</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
        {sent ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-medium text-stone-700">Recibimos tu mensaje.</p>
            <p className="text-sm text-stone-500 mt-1">Te responderemos por correo lo antes posible.</p>
            <button
              onClick={() => { setSent(false); setSubject(""); setMessage(""); }}
              className="mt-4 text-sm text-amber-600 font-medium hover:underline"
            >
              Enviar otro mensaje
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">Asunto</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="No puedo subir una foto"
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1.5">Mensaje</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Cuéntanos qué pasó..."
                className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 resize-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar"}
            </button>
          </form>
        )}
      </div>

      <div className="bg-stone-50 rounded-2xl border border-stone-100 p-5">
        <p className="text-sm font-medium text-stone-600 mb-3">O contáctanos directamente</p>
        <div className="flex flex-col gap-2">
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-emerald-600 transition"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp: {WHATSAPP}
          </a>
          <a
            href={`mailto:${EMAIL}`}
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-amber-600 transition"
          >
            <Mail className="w-4 h-4" /> {EMAIL}
          </a>
        </div>
      </div>
    </div>
  );
}
