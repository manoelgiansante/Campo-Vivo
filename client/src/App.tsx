import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MobileNavBar } from "./components/MobileNavBar";

// Pages - Dashboard profissional estilo OneSoil
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import MapView from "./pages/MapView";
import Fields from "./pages/Fields";
import FieldDetail from "./pages/FieldDetail";
import FieldDetailPro from "./pages/FieldDetailPro";
import FieldDrawNew from "./pages/FieldDrawNew";
import Notes from "./pages/Notes";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";

function Router() {
  const [location] = useLocation();
  
  // Dashboard tem sua própria navegação, esconder a navbar mobile
  const isDashboard = location === "/" || location === "/dashboard";
  const hideNavbar = isDashboard || location.startsWith('/fields/new') || location.includes('/edit') || location === '/auth';

  return (
    <>
      <Switch>
        {/* Dashboard principal estilo OneSoil */}
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        
        {/* Autenticação */}
        <Route path="/auth" component={Auth} />
        
        {/* Mapa - Tela dedicada ao mapa */}
        <Route path="/map" component={MapView} />

        {/* Campos */}
        <Route path="/fields" component={Fields} />
        <Route path="/fields/new" component={FieldDrawNew} />
        <Route path="/fields/:id" component={FieldDetail} />
        <Route path="/fields/:id/pro" component={FieldDetailPro} />
        <Route path="/fields/:id/edit" component={FieldDrawNew} />

        {/* Notas */}
        <Route path="/notes" component={Notes} />

        {/* Perfil */}
        <Route path="/profile" component={Profile} />

        {/* 404 */}
        <Route>
          <div className="flex items-center justify-center min-h-[100dvh] bg-gray-50">
            <div className="text-center">
              <p className="text-6xl mb-4">🌾</p>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Página não encontrada</h1>
              <p className="text-gray-500">A página que você procura não existe.</p>
            </div>
          </div>
        </Route>
      </Switch>
      
      {/* Navegação inferior - aparece em páginas mobile, não no dashboard */}
      {!hideNavbar && <MobileNavBar />}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster 
            position="top-center"
            toastOptions={{
              style: {
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
