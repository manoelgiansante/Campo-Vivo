import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  User, 
  Phone, 
  Building2, 
  LogOut,
  ChevronRight,
  Settings,
  HelpCircle,
  Shield,
  Bell,
  Leaf,
  Satellite,
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ProfileNew() {
  const { user, logout } = useAuth();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isLinkingFields, setIsLinkingFields] = useState(false);
  const [editData, setEditData] = useState({
    name: user?.name || "",
    phone: "",
    company: "",
    userType: "farmer" as "farmer" | "agronomist" | "consultant",
  });

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado!");
      setShowEditDialog(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar perfil");
    },
  });

  const linkAllFields = trpc.fields.linkAllToAgromonitoring.useMutation({
    onSuccess: (data) => {
      setIsLinkingFields(false);
      if (data.linked === data.total) {
        toast.success(`Todos os ${data.total} campos foram vinculados ao Agromonitoring!`);
      } else {
        toast.success(`${data.linked} de ${data.total} campos vinculados ao Agromonitoring`);
        // Mostrar detalhes dos erros
        const errors = data.results.filter(r => !r.success);
        if (errors.length > 0) {
          errors.forEach(e => {
            toast.error(`${e.name}: ${e.error}`);
          });
        }
      }
    },
    onError: (error) => {
      setIsLinkingFields(false);
      toast.error(`Erro ao vincular campos: ${error.message}`);
    },
  });

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const handleSaveProfile = () => {
    updateProfile.mutate(editData);
  };

  const handleLinkAllFields = () => {
    setIsLinkingFields(true);
    linkAllFields.mutate();
  };

  const userTypeLabels = {
    farmer: "Agricultor",
    agronomist: "Agrônomo",
    consultant: "Consultor",
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-green-600 px-4 pt-8 pb-16">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="px-4 -mt-10">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Leaf className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">
                {user?.name || "Usuário"}
              </h2>
              <p className="text-gray-500 text-sm">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                {userTypeLabels[editData.userType]}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => setShowEditDialog(true)}
          >
            Editar perfil
          </Button>
        </div>
      </div>

      {/* NDVI Integration Card */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Satellite className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Integração NDVI</h3>
              <p className="text-xs text-gray-500">Agromonitoring API</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Vincule seus campos ao serviço de satélite para visualizar dados NDVI em tempo real.
          </p>
          <Button
            onClick={handleLinkAllFields}
            disabled={isLinkingFields}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isLinkingFields ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Vinculando campos...
              </>
            ) : (
              <>
                <Satellite className="h-4 w-4 mr-2" />
                Vincular todos os campos
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl overflow-hidden">
          <MenuItem
            icon={<Bell className="h-5 w-5" />}
            label="Notificações"
            onClick={() => toast.info("Em breve!")}
          />
          <MenuItem
            icon={<Settings className="h-5 w-5" />}
            label="Configurações"
            onClick={() => toast.info("Em breve!")}
          />
          <MenuItem
            icon={<Shield className="h-5 w-5" />}
            label="Privacidade"
            onClick={() => toast.info("Em breve!")}
          />
          <MenuItem
            icon={<HelpCircle className="h-5 w-5" />}
            label="Ajuda"
            onClick={() => toast.info("Em breve!")}
            isLast
          />
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 mt-4">
        <Button
          variant="outline"
          className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sair
        </Button>
      </div>

      {/* Version */}
      <div className="text-center mt-8">
        <p className="text-gray-400 text-xs">CampoVivo v2.0</p>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="pl-10"
                  placeholder="Seu nome"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="pl-10"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Empresa/Fazenda</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={editData.company}
                  onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                  className="pl-10"
                  placeholder="Nome da empresa ou fazenda"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de usuário</Label>
              <Select
                value={editData.userType}
                onValueChange={(value: "farmer" | "agronomist" | "consultant") =>
                  setEditData({ ...editData, userType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="farmer">Agricultor</SelectItem>
                  <SelectItem value="agronomist">Agrônomo</SelectItem>
                  <SelectItem value="consultant">Consultor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfile.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {updateProfile.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  isLast = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isLast?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
        !isLast ? "border-b border-gray-100" : ""
      }`}
    >
      <div className="flex items-center gap-3 text-gray-700">
        {icon}
        <span>{label}</span>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400" />
    </button>
  );
}
