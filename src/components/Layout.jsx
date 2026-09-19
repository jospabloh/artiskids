import { Outlet, Link, useLocation } from "react-router-dom";
import { Palette, Upload, Home as HomeIcon } from "lucide-react";

const navItems = [
  { to: "/", label: "Inicio", icon: HomeIcon },
  { to: "/subir", label: "Subir dibujo", icon: Upload },
];

export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center shadow-sm">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-heading font-bold text-stone-800">Cápsula de Arte</div>
              <div className="text-[11px] text-stone-400 -mt-0.5">Recuerdos que duran para siempre</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition ${
                    active
                      ? "bg-amber-100 text-amber-700"
                      : "text-stone-500 hover:bg-stone-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="text-center text-xs text-stone-400 py-6">
        Hecho con cariño para las familias · Cápsula de Arte
      </footer>
    </div>
  );
}