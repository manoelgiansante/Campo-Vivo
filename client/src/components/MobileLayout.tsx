import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Leaf, Loader2 } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "./OfflineIndicator";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface MobileLayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  fullScreen?: boolean;
}

// Check if running in demo mode (no OAuth configured)
const isDemoMode = !import.meta.env.VITE_OAUTH_PORTAL_URL || !import.meta.env.VITE_APP_ID;

export function MobileLayout({ children, hideNav = false, fullScreen = false }: MobileLayoutProps) {
  const { loading, user } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect to login if not authenticated (except if already on login page)
  useEffect(() => {
    if (!loading && !user && location !== "/login" && location !== "/auth") {
      setLocation("/login");
    }
  }, [loading, user, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Se não tem usuário e não está na página de login, mostra loading (vai redirecionar)
  if (!user && location !== "/login" && location !== "/auth") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-100 ${fullScreen ? "" : "pb-16"}`}>
      <main className={fullScreen ? "h-screen" : ""}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <OfflineIndicator />
    </div>
  );
}
