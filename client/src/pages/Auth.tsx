import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  ArrowLeft,
  Leaf,
  Check
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "login" | "register";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      toast.success("Login realizado com sucesso!");
      utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao fazer login");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      toast.success("Conta criada com sucesso!");
      utils.auth.me.invalidate();
      // After registration, log them in
      loginMutation.mutate({ email, password });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar conta");
    },
  });

  // Redirect if already logged in (and not guest)
  useEffect(() => {
    if (!loading && user && !user.isGuest) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "register") {
      if (password !== confirmPassword) {
        toast.error("As senhas não coincidem");
        return;
      }
      if (password.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        return;
      }
      registerMutation.mutate({ email, password, name });
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div 
      className="min-h-[100dvh] bg-gradient-to-br from-green-500 to-green-700 flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <div className="p-4">
        <button
          onClick={() => setLocation("/")}
          className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl mb-4 mx-auto">
            <Leaf className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-white text-center">Campo Vivo</h1>
          <p className="text-white/80 text-center mt-1">
            {mode === "login" ? "Bem-vindo de volta!" : "Crie sua conta grátis"}
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
        >
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === "login" 
                  ? "bg-white text-gray-900 shadow" 
                  : "text-gray-500"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === "register" 
                  ? "bg-white text-gray-900 shadow" 
                  : "text-gray-500"
              }`}
            >
              Criar Conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <div className="relative mb-4">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-12 rounded-xl border-gray-200"
                      required={mode === "register"}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 rounded-xl border-gray-200"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 rounded-xl border-gray-200"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {mode === "register" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirmar senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 h-12 rounded-xl border-gray-200"
                      required={mode === "register"}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-base"
            >
              {isLoading 
                ? (mode === "login" ? "Entrando..." : "Criando conta...")
                : (mode === "login" ? "Entrar" : "Criar Conta Grátis")
              }
            </Button>
          </form>

          {mode === "register" && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Check className="h-4 w-4 text-green-500" />
                <span>Até 5 campos grátis</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Check className="h-4 w-4 text-green-500" />
                <span>Análise NDVI em tempo real</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Check className="h-4 w-4 text-green-500" />
                <span>Previsão do tempo 7 dias</span>
              </div>
            </div>
          )}

          {mode === "login" && (
            <button className="w-full mt-4 text-sm text-green-600 font-medium">
              Esqueci minha senha
            </button>
          )}
        </motion.div>

        {/* Guest option */}
        <button
          onClick={() => setLocation("/")}
          className="mt-6 text-white/80 text-sm"
        >
          Continuar sem conta
        </button>
      </div>
    </div>
  );
}
