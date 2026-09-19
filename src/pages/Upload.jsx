import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image as ImageIcon, Loader2, Save } from "lucide-react";

const ALBUM_SUGGESTIONS = ["Mis primeros trazos", "Animales", "La familia", "El cole", "Vacaciones", "Cumpleaños", "Otros"];

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", drawn_date: "", creator_name: "", album: "Otros" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Sube una foto del dibujo");
      return;
    }
    if (!form.title || !form.creator_name) {
      setError("Título y nombre del creador son obligatorios");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      await base44.entities.Drawing.create({
        ...form,
        drawn_date: form.drawn_date || new Date().toISOString().slice(0, 10),
        image_url: file_url,
      });
      navigate("/");
    } catch (err) {
      setError("No se pudo guardar el dibujo. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-heading font-bold text-2xl text-stone-800 mb-1">Subir un dibujo</h1>
      <p className="text-sm text-stone-500 mb-6">Digitaliza la obra en alta calidad para preservarla para siempre.</p>

      <form onSubmit={submit} className="space-y-5">
        {/* Dropzone / preview */}
        <label className="block">
          <div className="relative rounded-2xl border-2 border-dashed border-stone-200 bg-white overflow-hidden hover:border-amber-300 transition cursor-pointer">
            {preview ? (
              <div className="aspect-[4/3] bg-stone-50">
                <img src={preview} alt="preview" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="aspect-[4/3] flex flex-col items-center justify-center text-stone-400">
                <ImageIcon className="w-10 h-10 mb-2" />
                <p className="text-sm font-medium">Toca para subir una foto</p>
                <p className="text-xs">JPG, PNG · alta calidad recomendada</p>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </div>
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Título *">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="El sol y yo"
              className="input"
            />
          </Field>
          <Field label="Creador *">
            <input
              value={form.creator_name}
              onChange={(e) => setForm({ ...form, creator_name: e.target.value })}
              placeholder="Sofía (4 años)"
              className="input"
            />
          </Field>
          <Field label="Fecha del dibujo">
            <input
              type="date"
              value={form.drawn_date}
              onChange={(e) => setForm({ ...form, drawn_date: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Álbum">
            <select
              value={form.album}
              onChange={(e) => setForm({ ...form, album: e.target.value })}
              className="input"
            >
              {ALBUM_SUGGESTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Descripción (opcional)">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Un recuerdo sobre este dibujo..."
            rows={3}
            className="input resize-none"
          />
        </Field>

        {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {submitting ? "Guardando..." : "Guardar en la cápsula"}
        </button>
      </form>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.9rem;
          background: white;
          outline: none;
        }
        .input:focus { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.15); }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-600 mb-1.5">{label}</span>
      {children}
    </label>
  );
}