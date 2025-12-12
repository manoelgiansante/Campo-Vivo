import { Button } from "@/components/ui/button";
import { 
  Cloud,
  ChevronRight,
  Settings,
  Monitor,
  History,
  MessageCircle,
  FileText,
  Send,
  HelpCircle,
  LogOut,
  Tractor,
  Link2,
  AlertCircle,
  Building2,
  Share2,
  Crown,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function ProfileOneSoil() {
  const [, setLocation] = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 pb-24">
        {/* Not Logged In View */}
        <div className="p-4">
          <div className="bg-white rounded-2xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Cloud className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-600 mb-6">
              Crie uma conta ou faça login para salvar seus dados e acessar o aplicativo web com funcionalidades avançadas.
            </p>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-12 rounded-xl mb-3"
              onClick={() => setIsLoggedIn(true)}
            >
              Sou novo usuário
            </Button>
            <Button 
              variant="outline"
              className="w-full h-12 rounded-xl font-semibold"
              onClick={() => setIsLoggedIn(true)}
            >
              Já tenho uma conta
            </Button>
          </div>
        </div>

        {/* Integrations Section */}
        <div className="p-4">
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Integrações</p>
            <JohnDeereIntegration />
          </div>
        </div>

        {/* Settings Section */}
        <div className="p-4 pt-0">
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Conta</p>
            <MenuItem 
              icon={<Settings className="h-5 w-5 text-green-600" />}
              label="Configurações"
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Learn More Section */}
        <div className="p-4 pt-0">
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Saiba mais</p>
            <MenuItem 
              icon={<Monitor className="h-5 w-5 text-green-600" />}
              label="Recursos da versão web"
              onClick={() => {}}
            />
            <MenuItem 
              icon={<History className="h-5 w-5 text-green-600" />}
              label="Histórico de atualizações"
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Support Section */}
        <div className="p-4 pt-0">
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Suporte e Ajuda</p>
            <MenuItem 
              icon={<MessageCircle className="h-5 w-5 text-green-600" />}
              label="Chat de suporte"
              onClick={() => {}}
            />
            <MenuItem 
              icon={<FileText className="h-5 w-5 text-green-600" />}
              label="Guia do usuário"
              onClick={() => {}}
            />
            <MenuItem 
              icon={<Send className="h-5 w-5 text-green-600" />}
              label="Comunidade Telegram"
              onClick={() => {}}
            />
          </div>
        </div>
      </div>
    );
  }

  // Logged In View
  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Profile Header */}
      <div className="p-4">
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-green-600">M</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Manoel</h2>
              <p className="text-gray-500">manoel@campovivo.com</p>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations Section */}
      <div className="p-4 pt-0">
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Integrações</p>
          <JohnDeereIntegration />
        </div>
      </div>

      {/* Account Section */}
      <div className="p-4 pt-0">
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Conta</p>
          <MenuItem 
            icon={<Crown className="h-5 w-5 text-amber-500" />}
            label="Meu Plano"
            badge="Gratuito"
            onClick={() => setLocation("/plans")}
          />
          <MenuItem 
            icon={<Building2 className="h-5 w-5 text-green-600" />}
            label="Minhas Fazendas"
            onClick={() => setLocation("/farms")}
          />
          <MenuItem 
            icon={<Upload className="h-5 w-5 text-green-600" />}
            label="Importar Talhões"
            onClick={() => setLocation("/fields/import")}
          />
          <MenuItem 
            icon={<Settings className="h-5 w-5 text-green-600" />}
            label="Configurações"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Learn More Section */}
      <div className="p-4 pt-0">
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Saiba mais</p>
          <MenuItem 
            icon={<Monitor className="h-5 w-5 text-green-600" />}
            label="Recursos da versão web"
            onClick={() => {}}
          />
          <MenuItem 
            icon={<History className="h-5 w-5 text-green-600" />}
            label="Histórico de atualizações"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Support Section */}
      <div className="p-4 pt-0">
        <div className="bg-white rounded-2xl overflow-hidden">
          <p className="text-sm text-gray-500 px-4 pt-4 pb-2">Suporte e Ajuda</p>
          <MenuItem 
            icon={<MessageCircle className="h-5 w-5 text-green-600" />}
            label="Chat de suporte"
            onClick={() => {}}
          />
          <MenuItem 
            icon={<FileText className="h-5 w-5 text-green-600" />}
            label="Guia do usuário"
            onClick={() => {}}
          />
          <MenuItem 
            icon={<Send className="h-5 w-5 text-green-600" />}
            label="Comunidade Telegram"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* Logout */}
      <div className="p-4 pt-0">
        <Button 
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={() => setIsLoggedIn(false)}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sair
        </Button>
      </div>
    </div>
  );
}

// Menu Item Component
function MenuItem({
  icon,
  label,
  badge,
  onClick,
  danger = false
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
        danger ? "text-red-600" : "text-gray-900"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
        {badge && (
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400" />
    </button>
  );
}

// John Deere Integration Component
function JohnDeereIntegration() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate connection process
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
    }, 2000);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
  };

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* John Deere Logo */}
          <div className="w-10 h-10 bg-[#367C2B] rounded-lg flex items-center justify-center">
            <Tractor className="h-6 w-6 text-[#FFDE00]" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Integração com John Deere</p>
            {isConnected ? (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                Conectado
              </p>
            ) : (
              <p className="text-sm text-orange-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Integração não autorizada
              </p>
            )}
          </div>
        </div>
        
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleDisconnect}
          >
            Desconectar
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-[#367C2B] hover:bg-[#2d6a24] text-white"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? "Conectando..." : "Conectar"}
          </Button>
        )}
      </div>
      
      {!isConnected && (
        <p className="text-xs text-gray-500 mt-3 pl-13">
          Clique em "Conectar" para autorizar a integração com sua conta John Deere Operations Center.
        </p>
      )}
      
      {isConnected && (
        <div className="mt-3 p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">
            ✓ Sincronizando dados de máquinas e operações
          </p>
        </div>
      )}
    </div>
  );
}
