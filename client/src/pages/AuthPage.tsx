import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  User, 
  Mail, 
  Lock, 
  LogOut, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Leaf,
  Satellite,
  CloudRain,
  BarChart3,
  MapPin,
  Shield,
  Smartphone,
  Eye,
  EyeOff,
  ArrowRight,
  Sprout,
  Sun,
  Droplets
} from "lucide-react";
import { useLocation } from "wouter";

// API helper functions
async function apiCall(endpoint: string, data?: any) {
  const url = `/api/trpc/${endpoint}`;
  const options: RequestInit = {
    method: data ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };
  if (data) {
    options.body = JSON.stringify(data);
  }
  const response = await fetch(url, options);
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message || "Erro na requisição");
  }
  return json.result?.data;
}

interface UserData {
  id: number;
  name: string | null;
  email: string | null;
  userType?: string;
}

// Feature item component
function FeatureItem({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-colors">
        <Icon className="w-6 h-6 text-emerald-300" />
      </div>
      <div>
        <h3 className="font-semibold text-white text-lg">{title}</h3>
        <p className="text-emerald-100/70 text-sm mt-1">{description}</p>
      </div>
    </div>
  );
}

// Animated background shapes
function AnimatedShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating shapes */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-green-400/10 rounded-full blur-3xl animate-pulse delay-500" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEgMGExIDEgMCAxIDAgMiAwYTEgMSAwIDEgMCAtMiAwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L2c+PC9zdmc+')] opacity-30" />
    </div>
  );
}

// Stats component
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-emerald-200/70 text-sm mt-1">{label}</div>
    </div>
  );
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Show message helper
  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Check if user is already logged in
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const result = await apiCall("auth.me");
      if (result && result.id) {
        setCurrentUser(result);
        setIsAuthenticated(true);
        // Redirecionar para o mapa se já estiver logado
        setTimeout(() => setLocation("/map"), 500);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      showMessage("error", "Preencha todos os campos");
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiCall("auth.login", {
        email: loginEmail,
        password: loginPassword,
      });

      if (result?.user) {
        setCurrentUser(result.user);
        setIsAuthenticated(true);
        showMessage("success", "Login realizado com sucesso!");
        setTimeout(() => setLocation("/map"), 1000);
      }
    } catch (error: any) {
      showMessage("error", error.message || "Email ou senha incorretos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupName || !signupEmail || !signupPassword || !signupConfirmPassword) {
      showMessage("error", "Preencha todos os campos");
      return;
    }

    if (!acceptTerms) {
      showMessage("error", "Você precisa aceitar os termos de uso");
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      showMessage("error", "As senhas não coincidem");
      return;
    }

    if (signupPassword.length < 6) {
      showMessage("error", "A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiCall("auth.register", {
        name: signupName,
        email: signupEmail,
        password: signupPassword,
      });

      if (result?.user) {
        setCurrentUser(result.user);
        setIsAuthenticated(true);
        showMessage("success", "Conta criada com sucesso!");
        setTimeout(() => setLocation("/map"), 1000);
      }
    } catch (error: any) {
      showMessage("error", error.message || "Não foi possível criar a conta");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await apiCall("auth.logout", {});
    } catch (error) {
      // Ignore errors on logout
    } finally {
      setCurrentUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      showMessage("success", "Você saiu da sua conta");
    }
  };

  // Loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm">
              <Leaf className="w-10 h-10 text-emerald-400 animate-pulse" />
            </div>
            <div className="absolute inset-0 w-20 h-20 mx-auto border-4 border-emerald-400/30 rounded-full animate-spin border-t-emerald-400" />
          </div>
          <p className="mt-6 text-emerald-200 font-medium">Carregando CampoVivo...</p>
        </div>
      </div>
    );
  }

  // Authenticated user - redirect or show profile
  if (isAuthenticated && currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl">
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <User className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{currentUser.name || "Usuário"}</h2>
            <p className="text-emerald-200/70 mb-6">{currentUser.email}</p>
            
            <div className="bg-emerald-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-emerald-300">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Conectado ao CampoVivo</span>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold py-6 rounded-xl shadow-lg"
                onClick={() => setLocation("/map")}
              >
                Ir para o Mapa
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              
              <Button 
                variant="ghost" 
                className="w-full text-white/70 hover:text-white hover:bg-white/10" 
                onClick={handleLogout}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                Sair da conta
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login/Signup view
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900 flex">
      <AnimatedShapes />
      
      {/* Left side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-between p-12 z-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
            <Leaf className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">CampoVivo</h1>
            <p className="text-emerald-300/70 text-sm">Agricultura Inteligente</p>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-xl">
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Monitore suas lavouras com
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent"> tecnologia de satélite</span>
          </h2>
          <p className="text-xl text-emerald-100/80 mb-12">
            Acompanhe a saúde das suas plantações em tempo real, receba alertas de clima e tome decisões baseadas em dados.
          </p>

          {/* Features */}
          <div className="space-y-6">
            <FeatureItem 
              icon={Satellite} 
              title="Imagens de Satélite" 
              description="NDVI atualizado a cada 3-5 dias via Sentinel-2"
            />
            <FeatureItem 
              icon={CloudRain} 
              title="Previsão do Tempo" 
              description="Alertas climáticos e melhor horário para pulverização"
            />
            <FeatureItem 
              icon={BarChart3} 
              title="Análises Inteligentes" 
              description="Gráficos de desenvolvimento e histórico da lavoura"
            />
            <FeatureItem 
              icon={Smartphone} 
              title="Acesso em Qualquer Lugar" 
              description="Web e mobile com modo offline para o campo"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-12 pt-8 border-t border-white/10">
          <StatItem value="10m" label="Resolução por pixel" />
          <StatItem value="3-5" label="Dias de atualização" />
          <StatItem value="100%" label="Gratuito" />
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 lg:p-12 z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Leaf className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">CampoVivo</h1>
            <p className="text-emerald-300/70">Agricultura Inteligente</p>
          </div>

          {/* Message Banner */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 ${
              message.type === "success" 
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}>
              {message.type === "success" ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}

          {/* Auth Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
            {/* Tabs */}
            <div className="flex bg-white/5 rounded-xl p-1 mb-8">
              <button
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === "login"
                    ? "bg-white text-emerald-900 shadow-lg"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setActiveTab("signup")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === "signup"
                    ? "bg-white text-emerald-900 shadow-lg"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Criar Conta
              </button>
            </div>

            {/* Login Form */}
            {activeTab === "login" && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <Label htmlFor="login-email" className="text-white/90 text-sm font-medium mb-2 block">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="login-password" className="text-white/90 text-sm font-medium mb-2 block">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-12 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="remember" 
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                      className="border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <label htmlFor="remember" className="text-sm text-white/70 cursor-pointer">
                      Lembrar de mim
                    </label>
                  </div>
                  <button type="button" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">
                    Esqueceu a senha?
                  </button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                {/* Social login */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-transparent text-white/50">ou continue com</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                    </svg>
                    GitHub
                  </Button>
                </div>
              </form>
            )}

            {/* Signup Form */}
            {activeTab === "signup" && (
              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <Label htmlFor="signup-name" className="text-white/90 text-sm font-medium mb-2 block">
                    Nome completo
                  </Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="João Silva"
                      className="pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="signup-email" className="text-white/90 text-sm font-medium mb-2 block">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="signup-password" className="text-white/90 text-sm font-medium mb-2 block">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      className="pl-12 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="signup-confirm" className="text-white/90 text-sm font-medium mb-2 block">
                    Confirmar senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <Input
                      id="signup-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-12 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox 
                    id="terms" 
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                    className="border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 mt-0.5"
                  />
                  <label htmlFor="terms" className="text-sm text-white/70 cursor-pointer leading-tight">
                    Li e aceito os <span className="text-emerald-400 hover:underline">Termos de Uso</span> e a <span className="text-emerald-400 hover:underline">Política de Privacidade</span>
                  </label>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      Criar Conta Gratuita
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-white/40 mt-6">
            Seus dados são protegidos com criptografia de ponta a ponta
            <Shield className="w-3 h-3 inline-block ml-1 mb-0.5" />
          </p>
        </div>
      </div>
    </div>
  );
}
