import { useLocation } from "wouter";
import { Globe, Wheat, FileText, User } from "lucide-react";

const navItems = [
  { icon: Globe, label: "Map", path: "/" },
  { icon: Wheat, label: "Fields", path: "/fields" },
  { icon: FileText, label: "Notes", path: "/notes" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function BottomNav() {
  const [location, setLocation] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/" || location === "/map";
    return location.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active ? "text-green-600" : "text-gray-400"
              }`}
            >
              <item.icon 
                className={`h-6 w-6 ${active ? "stroke-[2px]" : "stroke-[1.5px]"}`} 
              />
              <span className={`text-xs mt-1 ${active ? "font-medium" : "font-normal"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
