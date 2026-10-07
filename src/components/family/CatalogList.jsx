import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { callFunction } from "@/lib/functions";
import { usePermissions } from "@/lib/usePermissions";
import { Plus, Trash2 } from "lucide-react";

export default function CatalogList({ entityName, label, fields, accent = "amber" }) {
  const { can } = usePermissions();
  const canManage = can("Catalogo", "manage");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(() => Object.fromEntries(fields.map((f) => [f.key, ""])));

  const load = () => {
    setLoading(true);
    base44.entities[entityName].list("name", 200).then(setItems).finally(() => setLoading(false));
  };

  useEffect(load, [entityName]);

  const add = async (e) => {
    e.preventDefault();
    if (!form[fields[0].key]?.trim()) return;
    const data = { ...form };
    fields.forEach((f) => { if (f.type === "date" && !data[f.key]) data[f.key] = undefined; });
    await callFunction("content", "createCatalogEntry", { entity: entityName, data });
    setForm(Object.fromEntries(fields.map((f) => [f.key, ""])));
    load();
  };

  const remove = async (id) => {
    await callFunction("content", "deleteCatalogEntry", { entity: entityName, id });
    load();
  };

  const accentMap = {
    amber: { btn: "bg-amber-500 hover:bg-amber-600", chip: "bg-amber-50 text-amber-700 border-amber-100", dot: "from-amber-300 to-orange-300" },
    rose: { btn: "bg-rose-500 hover:bg-rose-600", chip: "bg-rose-50 text-rose-700 border-rose-100", dot: "from-rose-300 to-pink-300" },
    sky: { btn: "bg-sky-500 hover:bg-sky-600", chip: "bg-sky-50 text-sky-700 border-sky-100", dot: "from-sky-300 to-cyan-300" },
  };
  const a = accentMap[accent] || accentMap.amber;

  return (
    <div>
      {canManage && (
      <form onSubmit={add} className="flex flex-wrap gap-2 mb-4">
        {fields.map((f) => (
          <input
            key={f.key}
            type={f.type || "text"}
            value={form[f.key]}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            placeholder={f.placeholder || f.label}
            className="flex-1 min-w-[120px] border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400"
          />
        ))}
        <button type="submit" className={`flex items-center gap-1 px-4 py-2 rounded-lg text-white text-sm font-medium ${a.btn} transition`}>
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </form>
      )}

      {loading ? (
        <div className="text-sm text-stone-400">Cargando...</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-stone-400">Aún no hay {label.toLowerCase()} registrados.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 bg-white border border-stone-100 rounded-xl px-3 py-2.5">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${a.dot} flex items-center justify-center text-xs font-bold text-white`}>
                {(item[fields[0].key] || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-700 truncate">{item[fields[0].key]}</div>
                {fields.slice(1).map((f) => item[f.key] && (
                  <div key={f.key} className="text-xs text-stone-400 truncate">{f.label}: {item[f.key]}</div>
                ))}
              </div>
              {canManage && (
                <button onClick={() => remove(item.id)} className="text-stone-300 hover:text-rose-500 transition p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}