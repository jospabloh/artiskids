import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import DrawingCard from "@/components/DrawingCard";
import { useDrawingImages } from "@/lib/useDrawingImages";
import { usePermissions } from "@/lib/usePermissions";
import { Image } from "@/components/ui/image";
import { Link } from "react-router-dom";
import { format, parseISO, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Sparkles, Upload, CalendarDays } from "lucide-react";

export default function Home() {
  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [albumFilter, setAlbumFilter] = useState("Todos");
  const imageUrls = useDrawingImages(drawings);
  const { can } = usePermissions();

  useEffect(() => {
    base44.entities.Drawing.list("-drawn_date", 200)
      .then(setDrawings)
      .finally(() => setLoading(false));
  }, []);

  const albums = useMemo(() => {
    const set = new Set(drawings.map((d) => d.album).filter(Boolean));
    return ["Todos", ...Array.from(set)];
  }, [drawings]);

  const todayMemories = useMemo(() => {
    const now = new Date();
    return drawings.filter((d) => {
      if (!d.drawn_date) return false;
      const dt = parseISO(d.drawn_date);
      return isSameDay(dt, now) && dt.getFullYear() !== now.getFullYear();
    });
  }, [drawings]);

  const filtered = useMemo(() => {
    if (albumFilter === "Todos") return drawings;
    return drawings.filter((d) => d.album === albumFilter);
  }, [drawings, albumFilter]);

  return (
    <div className="space-y-8">
      {/* Un día como hoy */}
      <section className="rounded-3xl bg-gradient-to-br from-amber-50 via-rose-50 to-orange-50 border border-amber-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="font-heading font-bold text-lg text-stone-800">Un día como hoy</h2>
        </div>
        <p className="text-sm text-stone-500 mb-4">
          {format(new Date(), "d 'de' MMMM", { locale: es })} · recuerdos de años anteriores
        </p>
        {todayMemories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {todayMemories.map((d) => (
              <Link key={d.id} to={`/dibujo/${d.id}`} className="block rounded-xl overflow-hidden bg-white border border-stone-100 shadow-sm hover:shadow-md transition">
                <div className="aspect-square bg-stone-50">
                  {imageUrls[d.id] ? (
                    <Image src={imageUrls[d.id]} alt={d.title} fittingType="fit" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full animate-pulse bg-stone-100" />
                  )}
                </div>
                <div className="p-2">
                  <div className="text-xs font-semibold text-stone-700 truncate">{d.title}</div>
                  <div className="text-[11px] text-stone-400">{d.drawn_date && parseISO(d.drawn_date).getFullYear()}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-stone-400 text-sm bg-white/60 rounded-xl p-4">
            <CalendarDays className="w-5 h-5" />
            Aún no hay recuerdos de esta fecha en años anteriores. ¡Sigue creando memorias!
          </div>
        )}
      </section>

      {/* Línea de tiempo */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-heading font-bold text-lg text-stone-800">Línea de tiempo</h2>
          {can("Dibujos", "upload") && (
            <Link
              to="/subir"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-800 text-white text-sm font-medium hover:bg-stone-900 transition"
            >
              <Upload className="w-4 h-4" /> Subir dibujo
            </Link>
          )}
        </div>

        {/* Filtros de álbum */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {albums.map((a) => (
            <button
              key={a}
              onClick={() => setAlbumFilter(a)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
                albumFilter === a
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-stone-500 border-stone-200 hover:border-amber-300"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                <div className="aspect-[4/3] bg-stone-100 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-stone-100 rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-stone-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7 text-amber-300" />
            </div>
            <p className="font-medium text-stone-500">Aún no hay dibujos aquí</p>
            <p className="text-sm">Sube el primer dibujo para empezar tu cápsula del tiempo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((d) => (
              <DrawingCard key={d.id} drawing={d} imageUrl={imageUrls[d.id]} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}