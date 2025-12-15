import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { 
  User, 
  Bell, 
  Moon, 
  Globe, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Camera,
  Shield,
  FileText,
  Mail,
  Phone,
  MapPin,
  Leaf,
  Settings,
  Star
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";

interface MenuItem {
  icon: React.ElementType;
  label: string;
  action: () => void;
  badge?: string;
  value?: string;
  toggle?: boolean;
}

interface MenuSection {
  section: string;
  items: MenuItem[];
}

export default function Profile() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const { data: fields } = trpc.fields.list.useQuery();

  const stats = useMemo(() => {
    if (!fields) return null;
    return {
      totalFields: fields.length,
      totalArea: fields.reduce((acc: number, f: any) => acc + (f.areaHectares || 0), 0),
      avgNdvi: fields.length > 0 
        ? fields.reduce((acc: number, f: any) => acc + (f.currentNdvi || 65), 0) / fields.length / 100
        : 0.65
    };
  }, [fields]);

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  const menuItems: MenuSection[] = [
    {
      section: 'Conta',
      items: [
        { icon: User, label: 'Editar Perfil', action: () => setLocation('/profile/edit') },
        { icon: Bell, label: 'Notificações', action: () => setLocation('/notifications/settings'), badge: '3' },
        { icon: Shield, label: 'Privacidade', action: () => setLocation('/privacy') },
      ]
    },
    {
      section: 'Preferências',
      items: [
        { icon: Moon, label: 'Modo Escuro', action: () => {}, toggle: true },
        { icon: Globe, label: 'Idioma', value: 'Português', action: () => {} },
        { icon: MapPin, label: 'Unidades', value: 'Hectares', action: () => {} },
      ]
    },
    {
      section: 'Suporte',
      items: [
        { icon: HelpCircle, label: 'Central de Ajuda', action: () => setLocation('/help') },
        { icon: Mail, label: 'Contato', action: () => window.open('mailto:suporte@campovivo.app') },
        { icon: FileText, label: 'Termos de Uso', action: () => setLocation('/terms') },
        { icon: Star, label: 'Avaliar o App', action: () => {} },
      ]
    },
  ];

  return (
    <div 
      className="min-h-[100dvh] bg-gray-50"
      style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      {/* Header */}
      <div 
        className="bg-gradient-to-br from-green-500 to-green-600 text-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}
      >
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold">Perfil</h1>
            <button 
              onClick={() => setLocation('/settings')}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
                {user?.image ? (
                  <img src={user.image} alt={user.name || ''} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-white/70" />
                )}
              </div>
              <button className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
                <Camera className="h-4 w-4 text-gray-700" />
              </button>
            </div>
            
            <div>
              <h2 className="text-xl font-bold">{user?.name || 'Usuário'}</h2>
              <p className="text-white/80 text-sm">{user?.email}</p>
              <div className="flex items-center gap-1 mt-1">
                <Leaf className="h-4 w-4 text-white/80" />
                <span className="text-white/80 text-sm">Produtor Rural</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-t-3xl -mb-6">
          <div className="grid grid-cols-3 py-5 px-4">
            <div className="text-center border-r border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{stats?.totalFields || 0}</p>
              <p className="text-xs text-gray-500">Campos</p>
            </div>
            <div className="text-center border-r border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{stats?.totalArea?.toFixed(1) || 0}</p>
              <p className="text-xs text-gray-500">Hectares</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats?.avgNdvi?.toFixed(2) || '0.65'}</p>
              <p className="text-xs text-gray-500">NDVI Médio</p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="pt-8 px-4 space-y-6">
        {menuItems.map((section) => (
          <div key={section.section}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              {section.section}
            </h3>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {section.items.map((item, index) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 ${
                    index > 0 ? 'border-t border-gray-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-900">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                    {item.value && (
                      <span className="text-sm text-gray-500">{item.value}</span>
                    )}
                    {item.toggle ? (
                      <div className="w-11 h-6 bg-gray-200 rounded-full relative">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Logout Button */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full bg-red-50 text-red-600 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2"
        >
          <LogOut className="h-5 w-5" />
          Sair da Conta
        </button>

        {/* Version */}
        <p className="text-center text-xs text-gray-400 py-4">
          Campo Vivo v1.0.0
        </p>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl p-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              Sair da conta?
            </h3>
            <p className="text-gray-500 text-center mb-6">
              Você precisará fazer login novamente para acessar sua conta.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleLogout}
                className="w-full bg-red-500 text-white py-4 rounded-xl font-semibold"
              >
                Sim, quero sair
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-xl font-semibold"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
