// @ts-nocheck
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  ArrowLeft, 
  Share2, 
  Link2, 
  Copy, 
  Mail, 
  Trash2, 
  Users,
  Loader2,
  Check,
  Eye,
  Edit3,
  Shield
} from "lucide-react";
// @ts-nocheck
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const PERMISSION_LABELS = {
  view: { label: "Visualizar", icon: Eye, description: "Pode ver o campo" },
  edit: { label: "Editar", icon: Edit3, description: "Pode editar dados" },
  admin: { label: "Admin", icon: Shield, description: "Controle total" },
};

export default function FieldShareOneSoil() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const fieldId = parseInt(params.id || "0");
  
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"view" | "edit" | "admin">("view");
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch field and shares
  const { data: field } = trpc.fields.getById.useQuery(
    { id: fieldId },
    { enabled: fieldId > 0 }
  );
  const { data: shares, isLoading, refetch } = trpc.sharing.getByField.useQuery(
    { fieldId },
    { enabled: fieldId > 0 }
  );

  // Mutations
  const createShare = trpc.sharing.create.useMutation({
    onSuccess: () => {
      toast.success("Convite enviado!");
      setShowInviteDialog(false);
      setInviteEmail("");
      refetch();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const getShareLink = trpc.sharing.getShareLink.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/share/${data.shareToken}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedLink(false), 3000);
      refetch();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const deleteShare = trpc.sharing.delete.useMutation({
    onSuccess: () => {
      toast.success("Compartilhamento removido!");
      refetch();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error("Digite um email válido");
      return;
    }
    createShare.mutate({
      fieldId,
      sharedWithEmail: inviteEmail,
      permission: invitePermission,
    });
  };

  const handleCopyLink = () => {
    getShareLink.mutate({ fieldId });
  };

  const handleDelete = (shareId: number) => {
    if (confirm("Remover este compartilhamento?")) {
      deleteShare.mutate({ id: shareId });
    }
  };

  // Find public share for link
  const publicShare = shares?.find(s => s.isPublic);

  if (!field) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/fields/${fieldId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Compartilhar</h1>
            <p className="text-sm text-gray-500">{field.name}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 space-y-3">
        {/* Copy Link */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Link de compartilhamento</h3>
                <p className="text-sm text-gray-500">Qualquer pessoa com o link pode visualizar</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={getShareLink.isPending}
            >
              {getShareLink.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : copiedLink ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {publicShare?.shareToken && (
            <div className="mt-3 p-2 bg-gray-50 rounded-lg">
              <code className="text-xs text-gray-600 break-all">
                {window.location.origin}/share/{publicShare.shareToken}
              </code>
            </div>
          )}
        </div>

        {/* Invite by Email */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Convidar por email</h3>
                <p className="text-sm text-gray-500">Envie um convite direto</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setShowInviteDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              Convidar
            </Button>
          </div>
        </div>
      </div>

      {/* Shared With */}
      <div className="px-4">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Compartilhado com
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : shares && shares.length > 0 ? (
          <div className="space-y-2">
            {shares.filter(s => !s.isPublic).map((share) => {
              const perm = PERMISSION_LABELS[share.permission as keyof typeof PERMISSION_LABELS];
              const PermIcon = perm?.icon || Eye;
              
              return (
                <div
                  key={share.id}
                  className="bg-white rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-lg font-medium text-gray-600">
                          {(share.sharedWithEmail?.[0] || "?").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {share.sharedWithEmail || "Usuário"}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <PermIcon className="h-3 w-3" />
                          {perm?.label || share.permission}
                          {share.acceptedAt && " • Aceito"}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(share.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 text-center">
            <Share2 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              Este campo ainda não foi compartilhado com ninguém
            </p>
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar por Email</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="usuario@exemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div>
              <Label>Permissão</Label>
              <Select value={invitePermission} onValueChange={(v) => setInvitePermission(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Visualizar
                    </div>
                  </SelectItem>
                  <SelectItem value="edit">
                    <div className="flex items-center gap-2">
                      <Edit3 className="h-4 w-4" />
                      Editar
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {PERMISSION_LABELS[invitePermission]?.description}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleInvite}
              disabled={createShare.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createShare.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
