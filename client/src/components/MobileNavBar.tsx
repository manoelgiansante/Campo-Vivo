import { useLocation } from "wouter";
import { Home, Map, Leaf, StickyNote, User } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { path: "/", icon: Home, label: "Início" },
  { path: "/map", icon: Map, label: "Mapa" },
  { path: "/fields", icon: Leaf, label: "Campos" },
  { path: "/notes", icon: StickyNote, label: "Notas" },
  { path: "/profile", icon: User, label: "Perfil" },
];

export function MobileNavBar() {
  const [location, setLocation] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className="relative flex flex-col items-center justify-center w-16 h-full"
            >
              {active && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute top-0 w-12 h-1 bg-green-500 rounded-b-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              
              <div className={`relative transition-colors ${active ? 'text-green-600' : 'text-gray-400'}`}>
                <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
              </div>
              
              <span className={`text-[10px] mt-1 font-medium ${active ? 'text-green-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
