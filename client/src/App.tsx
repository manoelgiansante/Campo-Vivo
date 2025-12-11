import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MobileLayout } from "./components/MobileLayout";

// New OneSoil-style pages
import MapView from "./pages/MapView";
import FieldsList from "./pages/FieldsList";
import FieldDetailNew from "./pages/FieldDetailNew";
import FieldDrawNew from "./pages/FieldDrawNew";
import NotesNew from "./pages/NotesNew";
import ProfileNew from "./pages/ProfileNew";

function Router() {
  return (
    <Switch>
      {/* Main Map View (home) */}
      <Route path="/">
        {() => (
          <MobileLayout fullScreen>
            <MapView />
          </MobileLayout>
        )}
      </Route>
      <Route path="/map">
        {() => (
          <MobileLayout fullScreen>
            <MapView />
          </MobileLayout>
        )}
      </Route>

      {/* Fields */}
      <Route path="/fields">
        {() => (
          <MobileLayout>
            <FieldsList />
          </MobileLayout>
        )}
      </Route>
      <Route path="/fields/new">
        {() => (
          <MobileLayout hideNav fullScreen>
            <FieldDrawNew />
          </MobileLayout>
        )}
      </Route>
      <Route path="/fields/:id">
        {() => (
          <MobileLayout>
            <FieldDetailNew />
          </MobileLayout>
        )}
      </Route>

      {/* Notes */}
      <Route path="/notes">
        {() => (
          <MobileLayout>
            <NotesNew />
          </MobileLayout>
        )}
      </Route>

      {/* Profile */}
      <Route path="/profile">
        {() => (
          <MobileLayout>
            <ProfileNew />
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
