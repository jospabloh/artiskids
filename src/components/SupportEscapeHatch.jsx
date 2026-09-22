import { MessageCircle, Mail } from "lucide-react";

export const WHATSAPP = "449 895 8291";
export const WHATSAPP_HREF = "https://wa.me/524498958291";
export const EMAIL = "soporte@acaciaco.com.mx";

// The escape hatch every unrecoverable error must offer instead of
// dead-ending (Module 10's "no dead ends" rule, generalized past the login
// page it's written for -- callFunction's isRouterError flag is what tells
// a caller when to reach for this instead of an inline message). WhatsApp
// works with zero backend dependency, so it's the one channel that's never
// itself broken by whatever just failed.
export default function SupportEscapeHatch({ contextMessage }) {
  return (
    <div className="space-y-2">
      <a
        href={`${WHATSAPP_HREF}?text=${encodeURIComponent(contextMessage)}`}
        target="_blank"
        rel="noreferrer"
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition"
      >
        <MessageCircle className="w-4 h-4" /> WhatsApp: {WHATSAPP}
      </a>
      <a
        href={`mailto:${EMAIL}?subject=${encodeURIComponent(contextMessage)}`}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-stone-200 text-stone-600 font-semibold hover:bg-stone-50 transition"
      >
        <Mail className="w-4 h-4" /> {EMAIL}
      </a>
    </div>
  );
}
