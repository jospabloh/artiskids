import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { callFunction } from "@/lib/functions";
import { Image } from "@/components/ui/image";
import { useDrawingImages } from "@/lib/useDrawingImages";
import { usePermissions } from "@/lib/usePermissions";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Send, Heart, Trash2 } from "lucide-react";

const EMOJIS = ["❤️", "👏", "😍", "🎨", "⭐", "🥰"];

export default function DrawingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [drawing, setDrawing] = useState(null);
  const [comments, setComments] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [author, setAuthor] = useState("");
  const [posting, setPosting] = useState(false);
  const [people, setPeople] = useState([]);
  const imageUrl = useDrawingImages(drawing ? [drawing] : [])[drawing?.id];
  const { can } = usePermissions();

  useEffect(() => {
    Promise.all([
      base44.entities.Parent.list("name", 100).catch(() => []),
      base44.entities.Relative.list("name", 100).catch(() => []),
    ]).then(([p, r]) => setPeople([...p, ...r]));
  }, []);

  const loadAll = async () => {
    try {
      const d = await base44.entities.Drawing.get(id);
      setDrawing(d);
      const [cs, rs] = await Promise.all([
        base44.entities.Comment.filter({ drawing_id: id }, "-created_date", 100),
        base44.entities.Reaction.filter({ drawing_id: id }, "-created_date", 200),
      ]);
      setComments(cs);
      setReactions(rs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const reactionCounts = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const addReaction = async (emoji) => {
    await callFunction("content", "createReaction", { drawing_id: id, author_name: author || "Familiar", emoji });
    setReactions(await base44.entities.Reaction.filter({ drawing_id: id }, "-created_date", 200));
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      await callFunction("content", "createComment", {
        drawing_id: id,
        author_name: author || "Familiar",
        text: commentText.trim(),
      });
      setCommentText("");
      setComments(await base44.entities.Comment.filter({ drawing_id: id }, "-created_date", 100));
    } finally {
      setPosting(false);
    }
  };

  const remove = async () => {
    if (!confirm("¿Eliminar este dibujo de la cápsula? Esta acción no se puede deshacer.")) return;
    await callFunction("content", "deleteDrawing", { id });
    navigate("/");
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" /></div>;
  }
  if (!drawing) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">No se encontró el dibujo.</p>
        <Link to="/" className="text-amber-600 text-sm font-medium">Volver al inicio</Link>
      </div>
    );
  }

  const date = drawing.drawn_date ? format(parseISO(drawing.drawn_date), "d 'de' MMMM, yyyy", { locale: es }) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <div className="bg-stone-50">
          {imageUrl ? (
            <Image src={imageUrl} alt={drawing.title} fittingType="fit" className="w-full max-h-[70vh] object-contain" />
          ) : (
            <div className="w-full aspect-[4/3] animate-pulse bg-stone-100" />
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-heading font-bold text-2xl text-stone-800">{drawing.title}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-stone-500">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-300 to-amber-300 flex items-center justify-center text-xs font-bold text-white">
                  {(drawing.creator_name || "?").charAt(0).toUpperCase()}
                </span>
                <span className="font-medium text-stone-600">{drawing.creator_name}</span>
                {date && <span>· {date}</span>}
              </div>
            </div>
            {drawing.album && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                {drawing.album}
              </span>
            )}
          </div>
          {drawing.description && (
            <p className="mt-4 text-stone-600 text-sm leading-relaxed whitespace-pre-line">{drawing.description}</p>
          )}

          {/* Reacciones */}
          <div className="mt-5 pt-4 border-t border-stone-100">
            <div className="flex flex-wrap gap-2 mb-3">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  onClick={() => addReaction(em)}
                  disabled={!can("Reacciones", "create")}
                  className="relative px-3 py-1.5 rounded-full bg-stone-50 border border-stone-200 hover:bg-amber-50 hover:border-amber-200 transition text-lg"
                >
                  {em}
                  {reactionCounts[em] > 0 && (
                    <span className="ml-1 text-xs font-bold text-stone-500">{reactionCounts[em]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comentarios */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
        <h2 className="font-heading font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-400" /> Comentarios ({comments.length})
        </h2>

        <div className="space-y-3 mb-4">
          {comments.length === 0 && <p className="text-sm text-stone-400">Sé el primero en dejar un comentario.</p>}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-amber-200 to-rose-200 flex items-center justify-center text-xs font-bold text-stone-600">
                {(c.author_name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="bg-stone-50 rounded-xl px-3 py-2 flex-1">
                <div className="text-xs font-semibold text-stone-600">{c.author_name}</div>
                <div className="text-sm text-stone-700">{c.text}</div>
              </div>
            </div>
          ))}
        </div>

        {can("Comentarios", "create") && (
        <form onSubmit={submitComment} className="space-y-3">
          {people.length > 0 ? (
            <select
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400"
            >
              <option value="">¿Quién comenta?</option>
              {people.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          ) : (
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Tu nombre"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400"
            />
          )}
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escribe un comentario..."
              className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={posting || !commentText.trim()}
              className="px-4 rounded-lg bg-amber-500 text-white flex items-center justify-center disabled:opacity-50 hover:bg-amber-600 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
        )}
      </div>

      {can("Dibujos", "delete") && (
      <button
        onClick={remove}
        className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-rose-500 transition"
      >
        <Trash2 className="w-4 h-4" /> Eliminar dibujo
      </button>
      )}
    </div>
  );
}