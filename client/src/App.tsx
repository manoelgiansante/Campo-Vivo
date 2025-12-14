import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MobileLayout } from "./components/MobileLayout";

// Pages
import MapView from "./pages/MapView";
import FieldsOneSoil from "./pages/FieldsOneSoil";
import FieldDetailNew from "./pages/FieldDetailNew";
import FieldDetailPro from "./pages/FieldDetailPro";
import FieldDrawNew from "./pages/FieldDrawNew";
import NotesNew from "./pages/NotesNew";
import ProfileNew from "./pages/ProfileNew";

function Router() {
  return (
    <Switch>
      {/* Mapa - Tela principal */}
      <Route path="/">
        <MobileLayout fullScreen>
          <MapView />
        </MobileLayout>
      </Route>
      
      <Route path="/map">
        <MobileLayout fullScreen>
          <MapView />
        </MobileLayout>
      </Route>

      {/* Campos */}
      <Route path="/fields">
        <FieldsOneSoil />
      </Route>
      
      <Route path="/fields/new">
        <MobileLayout hideNav fullScreen>
          <FieldDrawNew />
        </MobileLayout>
      </Route>
      
      <Route path="/fields/:id">
        <MobileLayout>
          <FieldDetailNew />
        </MobileLayout>
      </Route>
      
      <Route path="/fields/:id/pro">
        <FieldDetailPro />
      </Route>

      {/* Notas */}
      <Route path="/notes">
        <MobileLayout>
          <NotesNew />
        </MobileLayout>
      </Route>

      {/* Perfil */}
      <Route path="/profile">
        <MobileLayout>
          <ProfileNew />
        </MobileLayout>
      </Route>

      {/* 404 */}
      <Route>
        <MobileLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-gray-500">Página não encontrada</p>
          </div>
        </MobileLayout>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
