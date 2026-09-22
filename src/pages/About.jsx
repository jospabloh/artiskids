import { APP_VERSION, RELEASE_DATE, CHANGELOG } from "@/lib/appConfig";
import { Palette, MessageCircle, Mail } from "lucide-react";

const WHATSAPP = "449 895 8291";
const WHATSAPP_HREF = "https://wa.me/524498958291";
const EMAIL = "soporte@acaciaco.com.mx";

// Module 21: version + changelog + support contact, all read from the one
// place scripts/release.mjs is allowed to write -- no separate copy to
// forget updating here when a release ships.
export default function About() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center py-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center shadow-sm mb-3">
          <Palette className="w-7 h-7 text-white" />
        </div>
        <h1 className="font-heading font-bold text-2xl text-stone-800">ArtisKids</h1>
        <p className="text-sm text-stone-400 mt-1">
          Versión {APP_VERSION} · {RELEASE_DATE}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
        <h2 className="font-heading font-semibold text-stone-800 mb-3">Novedades</h2>
        <div className="space-y-4">
          {CHANGELOG.map((entry) => (
            <div key={entry.version}>
              <div className="text-xs font-semibold text-amber-600 mb-1">
                {entry.version} · {entry.date}
              </div>
              <ul className="text-sm text-stone-600 list-disc list-inside space-y-0.5">
                {entry.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-stone-50 rounded-2xl border border-stone-100 p-5">
        <p className="text-sm font-medium text-stone-600 mb-3">Soporte</p>
        <div className="flex flex-col gap-2">
          <a href={WHATSAPP_HREF} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-stone-600 hover:text-emerald-600 transition">
            <MessageCircle className="w-4 h-4" /> WhatsApp: {WHATSAPP}
          </a>
          <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 text-sm text-stone-600 hover:text-amber-600 transition">
            <Mail className="w-4 h-4" /> {EMAIL}
          </a>
        </div>
      </div>

      <p className="text-center text-xs text-stone-400">
        Hecho con cariño por <span className="font-semibold text-stone-500">Acacia Consultoría</span>
      </p>
    </div>
  );
}
