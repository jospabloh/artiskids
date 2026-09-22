import { Outlet, Link, useLocation } from "react-router-dom";
import { Upload, Home as HomeIcon, Users, User, LifeBuoy, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { to: "/", label: "Inicio", icon: HomeIcon },
  { to: "/subir", label: "Subir dibujo", icon: Upload },
  { to: "/familia", label: "Familia", icon: Users },
  { to: "/soporte", label: "Soporte", icon: LifeBuoy },
  { to: "/cuenta", label: "Mi cuenta", icon: User },
];

export default function Layout() {
  const location = useLocation();
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.jpg" alt="ArtisKids" className="w-9 h-9 rounded-xl object-cover shadow-sm" />

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
            <button
              onClick={() => logout()}
              title="Cerrar sesión"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-stone-400 hover:bg-stone-100 hover:text-rose-500 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
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
    </div>
  );
}