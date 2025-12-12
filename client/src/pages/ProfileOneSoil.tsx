import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Mail, Lock, LogOut, Loader2, CheckCircle, AlertCircle } from "lucide-react";

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

export default function ProfileOneSoil() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

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
      }
    } catch (error) {
      // User not logged in - this is fine
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
        setLoginEmail("");
        setLoginPassword("");
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
      const result = await apiCall("auth.signup", {
        name: signupName,
        email: signupEmail,
        password: signupPassword,
      });

      if (result?.user) {
        setCurrentUser(result.user);
        setIsAuthenticated(true);
        showMessage("success", "Conta criada com sucesso! Bem-vindo ao CampoVivo!");
        setSignupName("");
        setSignupEmail("");
        setSignupPassword("");
        setSignupConfirmPassword("");
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
      <div className="container mx-auto py-8 px-4 max-w-md flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Authenticated user view
  if (isAuthenticated && currentUser) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-md">
        {/* Message Banner */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}>
            {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">{currentUser.name || "Usuário"}</CardTitle>
            <CardDescription>{currentUser.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                ✓ Conta ativa no CampoVivo
              </p>
              <p className="text-xs text-green-600 mt-1">
                ID: {currentUser.id} • Tipo: {currentUser.userType || "farmer"}
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Login/Signup view
  return (
    <div className="container mx-auto py-8 px-4 max-w-md">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-green-700">🌾 CampoVivo</h1>
        <p className="text-gray-600">Gestão inteligente de fazendas</p>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="João Silva"
                      className="pl-10"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="pl-10"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    "Criar Conta"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>

      <p className="text-center text-xs text-gray-500 mt-4">
        Seus dados são salvos com segurança no Supabase
      </p>
    </div>
  );
}
