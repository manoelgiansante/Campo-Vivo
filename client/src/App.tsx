import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MobileLayout } from "./components/MobileLayout";

// OneSoil-style pages
import MapViewNew from "./pages/MapViewNew";
import FieldsListNew from "./pages/FieldsListNew";
import FieldDetailOneSoil from "./pages/FieldDetailOneSoil";
import FieldDrawOneSoil from "./pages/FieldDrawOneSoil";
import FieldDrawPro from "./pages/FieldDrawPro";
import NotesOneSoil from "./pages/NotesOneSoil";
import ProfileOneSoil from "./pages/ProfileOneSoil";

function Router() {
  return (
    <Switch>
      {/* Main Map View (home) */}
      <Route path="/">
        {() => (
          <MobileLayout fullScreen>
            <MapViewNew />
          </MobileLayout>
        )}
      </Route>
      <Route path="/map">
        {() => (
          <MobileLayout fullScreen>
            <MapViewNew />
          </MobileLayout>
        )}
      </Route>

      {/* Fields */}
      <Route path="/fields">
        {() => (
          <MobileLayout>
            <FieldsListNew />
          </MobileLayout>
        )}
      </Route>
      <Route path="/fields/new">
        {() => (
          <MobileLayout hideNav fullScreen>
            <FieldDrawOneSoil />
          </MobileLayout>
        )}
      </Route>
      <Route path="/fields/draw">
        {() => (
          <MobileLayout hideNav fullScreen>
            <FieldDrawPro />
          </MobileLayout>
        )}
      </Route>
      <Route path="/fields/:id">
        {() => (
          <MobileLayout>
            <FieldDetailOneSoil />
          </MobileLayout>
        )}
      </Route>

      {/* Notes */}
      <Route path="/notes">
        {() => (
          <MobileLayout>
            <NotesOneSoil />
          </MobileLayout>
        )}
      </Route>

      {/* Profile */}
      <Route path="/profile">
        {() => (
          <MobileLayout>
            <ProfileOneSoil />
          </MobileLayout>
        )}
      </Route>

      {/* Fallback */}
      <Route>
        {() => (
          <MobileLayout>
            <div className="flex items-center justify-center min-h-[60vh]">
              <p className="text-gray-500">Página não encontrada</p>
            </div>
          </MobileLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
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

export default App;
