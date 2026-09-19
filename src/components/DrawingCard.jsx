import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function DrawingCard({ drawing }) {
  const date = drawing.drawn_date ? format(parseISO(drawing.drawn_date), "d 'de' MMMM, yyyy", { locale: es }) : null;
  return (
    <Link
      to={`/dibujo/${drawing.id}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm hover:shadow-md transition"
    >
      <div className="aspect-[4/3] bg-stone-50 overflow-hidden">
        <Image
          src={drawing.image_url}
          alt={drawing.title}
          fittingType="fit"
          className="w-full h-full object-contain group-hover:scale-[1.02] transition duration-300"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading font-semibold text-stone-800 leading-tight">{drawing.title}</h3>
          {drawing.album && (
            <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
              {drawing.album}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-stone-500">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-300 to-amber-300 flex items-center justify-center text-[11px] font-bold text-white">
            {(drawing.creator_name || "?").charAt(0).toUpperCase()}
          </span>
          <span className="font-medium text-stone-600">{drawing.creator_name}</span>
          {date && <span className="text-stone-400">· {date}</span>}
        </div>
      </div>
    </Link>
  );
}