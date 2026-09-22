import { Outlet, Link, useLocation } from "react-router-dom";
import { Upload, Home as HomeIcon, Users, User, LifeBuoy, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

// tabLabel is what fits a fifth of a 390px screen at 11px; label is the
// full word used in the desktop pill nav, which has room for it.
const navItems = [
  { to: "/", label: "Inicio", tabLabel: "Inicio", icon: HomeIcon },
  { to: "/subir", label: "Subir dibujo", tabLabel: "Subir", icon: Upload },
  { to: "/familia", label: "Familia", tabLabel: "Familia", icon: Users },
  { to: "/soporte", label: "Soporte", tabLabel: "Soporte", icon: LifeBuoy },
  { to: "/cuenta", label: "Mi cuenta", tabLabel: "Cuenta", icon: User },
];

export default function Layout() {
  const location = useLocation();
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src="/logo.jpg" alt="ArtisKids" className="w-9 h-9 rounded-xl object-cover shadow-sm shrink-0" />
            <div className="leading-tight min-w-0">
              <div className="font-heading font-bold text-stone-800 truncate">Cápsula de Arte</div>
              <div className="hidden sm:block text-[11px] text-stone-400 -mt-0.5">Recuerdos que duran para siempre</div>
            </div>
          </Link>
          {/* Full pill nav has room for icon+label only from sm up -- below
              that it moves to the fixed bottom tab bar (see nav below main). */}
          <nav className="hidden sm:flex items-center gap-1">
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
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => logout()}
              title="Cerrar sesión"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-stone-400 hover:bg-stone-100 hover:text-rose-500 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
          <button
            onClick={() => logout()}
            title="Cerrar sesión"
            className="sm:hidden shrink-0 p-2 -mr-2 rounded-full text-stone-400 active:bg-stone-100 active:text-rose-500 transition"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>
      <footer className="text-center text-xs text-stone-400 py-6">
        Hecho con cariño para las familias · Cápsula de Arte
        <div className="mt-1 text-stone-400">Hecho por <span className="font-semibold text-stone-500">Acacia Consultoría</span></div>
        <div className="mt-2 flex items-center justify-center gap-3">
          <Link to="/permisos" className="hover:text-stone-600 transition">Permisos</Link>
          <Link to="/acerca" className="hover:text-stone-600 transition">Acerca de</Link>
        </div>
      </footer>

      {/* Mobile-only bottom tab bar -- thumb-reach primary nav, icon above
          label, safe-area padding for the iPhone home-indicator strip. */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-amber-100"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10.5px] font-medium transition ${
                  active ? "text-amber-600" : "text-stone-400 active:text-stone-600"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "text-amber-600" : "text-stone-400"}`} />
                {item.tabLabel}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}