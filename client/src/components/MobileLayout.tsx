import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl, isOAuthConfigured } from "@/const";
import { Leaf, Loader2 } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "./OfflineIndicator";

interface MobileLayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  fullScreen?: boolean;
}

export function MobileLayout({ children, hideNav = false, fullScreen = false }: MobileLayoutProps) {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  // If no user but OAuth not configured, render content anyway (demo mode)
  if (!user && !isOAuthConfigured()) {
    return (
      <div 
        className={`min-h-screen min-h-[100dvh] bg-gray-100 ${fullScreen ? "" : "pb-[calc(4rem+env(safe-area-inset-bottom))]"}`}
        style={{ paddingTop: fullScreen ? 'env(safe-area-inset-top)' : undefined }}
      >
        <main className={fullScreen ? "h-[100dvh]" : ""}>
          {children}
        </main>
        {!hideNav && <BottomNav />}
        <OfflineIndicator />
      </div>
    );
  }

  if (!user) {
    const loginUrl = getLoginUrl();
    return (
      <div 
        className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-6"
        style={{ 
          paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))'
        }}
      >
        <div className="flex flex-col items-center gap-6 max-w-sm w-full">
          <div className="h-20 w-20 rounded-2xl bg-green-100 flex items-center justify-center">
            <Leaf className="h-10 w-10 text-green-600" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">CampoVivo</h1>
            <p className="text-gray-500 text-sm">
              Monitore seus campos com imagens de satélite e dados de vegetação em tempo real.
            </p>
          </div>
          {loginUrl && (
            <Button
              onClick={() => {
                window.location.href = loginUrl;
              }}
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-12 rounded-xl"
            >
              Entrar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen min-h-[100dvh] bg-gray-100 ${fullScreen ? "" : "pb-[calc(4rem+env(safe-area-inset-bottom))]"}`}
      style={{ paddingTop: fullScreen ? 'env(safe-area-inset-top)' : undefined }}
    >
      <main className={fullScreen ? "h-[100dvh]" : ""}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <OfflineIndicator />
    </div>
  );
}
