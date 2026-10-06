import { useState } from "react";
import CatalogList from "@/components/family/CatalogList";
import { Baby, Users, Heart } from "lucide-react";

const TABS = [
  { key: "children", label: "Hijos", icon: Baby, accent: "amber", entity: "Child", fields: [
    { key: "name", label: "Nombre", placeholder: "Sofía" },
    { key: "birth_date", label: "Nacimiento", type: "date" },
  ]},
  { key: "parents", label: "Padres", icon: Users, accent: "sky", entity: "Parent", fields: [
    { key: "name", label: "Nombre", placeholder: "María" },
    { key: "email", label: "Correo", placeholder: "maria@correo.com" },
  ]},
  { key: "relatives", label: "Familiares", icon: Heart, accent: "rose", entity: "Relative", fields: [
    { key: "name", label: "Nombre", placeholder: "Abuela Rosa" },
    { key: "relationship", label: "Parentesco", placeholder: "Abuela" },
  ]},
];

export default function Family() {
  const [tab, setTab] = useState("children");
  const active = TABS.find((t) => t.key === tab);

  return (
    <div>
      <h1 className="font-heading font-bold text-2xl text-stone-800 mb-1">La familia</h1>
      <p className="text-sm text-stone-500 mb-6">Gestiona los catálogos de hijos, padres y familiares.</p>

      <div className="flex gap-1 sm:gap-2 mb-6 border-b border-stone-100">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex min-w-0 items-center gap-1.5 px-2.5 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                isActive ? "border-amber-500 text-stone-800" : "border-transparent text-stone-400 hover:text-stone-600"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
        <CatalogList
          key={active.key}
          entityName={active.entity}
          label={active.label}
          fields={active.fields}
          accent={active.accent}
        />
      </div>
    </div>
  );
}